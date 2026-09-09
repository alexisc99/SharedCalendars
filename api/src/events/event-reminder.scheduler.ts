import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

/** "dans 1 jour", "dans 2 heures", "dans 1 h 30", "dans 15 minutes"… */
function formatLeadTime(minutesBefore: number): string {
  if (minutesBefore % 1440 === 0) {
    const days = minutesBefore / 1440;
    return `dans ${days} jour${days > 1 ? 's' : ''}`;
  }
  if (minutesBefore % 60 === 0) {
    const hours = minutesBefore / 60;
    return `dans ${hours} heure${hours > 1 ? 's' : ''}`;
  }
  if (minutesBefore > 60) {
    const hours = Math.floor(minutesBefore / 60);
    const rest = minutesBefore % 60;
    return `dans ${hours} h ${String(rest).padStart(2, '0')}`;
  }
  return `dans ${minutesBefore} minute${minutesBefore > 1 ? 's' : ''}`;
}

/**
 * Déclenche les rappels d'événement (EventReminder.minutesBefore) au bon
 * moment. Jusqu'ici ces lignes n'étaient que stockées en base : rien ne les
 * lisait jamais pour prévenir qui que ce soit.
 */
@Injectable()
export class EventReminderScheduler {
  private readonly logger = new Logger(EventReminderScheduler.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDueReminders() {
    const now = new Date();

    // On ne regarde que les rappels d'événements publiés qui n'ont pas
    // encore commencé — un rappel n'a pas de sens pour un événement déjà
    // passé, et un événement PENDING n'est pas encore confirmé.
    const reminders = await this.prisma.eventReminder.findMany({
      where: {
        event: { status: 'PUBLISHED', startDateTime: { gt: now } },
      },
      include: { event: true },
    });

    for (const reminder of reminders) {
      const fireAt = new Date(
        reminder.event.startDateTime.getTime() - reminder.minutesBefore * 60_000,
      );
      if (fireAt > now) continue; // pas encore l'heure

      await this.sendReminderOnce(reminder);
    }
  }

  /** Idempotent via l'audit log (même schéma que GroupPlanExpirationService) —
   * pas de champ "envoyé" dédié sur EventReminder, on vérifie juste qu'on n'a
   * pas déjà loggé l'envoi de ce rappel précis. */
  private async sendReminderOnce(
    reminder: { id: string; minutesBefore: number; event: { id: string; title: string; calendarId: string; creatorId: string } },
  ) {
    const alreadySent = await this.prisma.auditLog.findFirst({
      where: {
        action: 'EVENT_REMINDER_SENT',
        entity: 'EventReminder',
        entityId: reminder.id,
      },
    });
    if (alreadySent) return;

    const members = await this.prisma.calendarMember.findMany({
      where: { calendarId: reminder.event.calendarId },
      select: { userId: true },
    });

    await this.notifications.notifyUsers(
      members.map((m) => m.userId),
      {
        type: 'EVENT_REMINDER',
        title: `Rappel : ${reminder.event.title}`,
        message: `L'événement commence ${formatLeadTime(reminder.minutesBefore)}.`,
        eventId: reminder.event.id,
      },
    );

    await this.auditService.log({
      userId: reminder.event.creatorId,
      action: 'EVENT_REMINDER_SENT',
      entity: 'EventReminder',
      entityId: reminder.id,
      metadata: {
        eventId: reminder.event.id,
        calendarId: reminder.event.calendarId,
        minutesBefore: reminder.minutesBefore,
      },
    });

    this.logger.log(`EVENT_REMINDER_SENT for reminder ${reminder.id} (event ${reminder.event.id})`);
  }
}
