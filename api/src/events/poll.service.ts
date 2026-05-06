import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
@Injectable()
export class PollService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async vote(userId: string, eventId: string, optionId: string) {
    // Vérifier que le poll existe
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { pollOptions: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    if (event.type !== 'POLL')
      throw new ForbiddenException('This event is not a poll');

    // Vérifier que l'option appartient à l'événement
    const option = event.pollOptions.find((o) => o.id === optionId);
    if (!option) throw new ForbiddenException('Invalid poll option');

    // Vérifier membership
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId: event.calendarId },
    });
    if (!membership)
      throw new ForbiddenException('You are not a member of this calendar');

    if (membership.role === 'viewer')
      throw new ForbiddenException('Viewers cannot vote');

    // upsert vote
    return this.prisma.pollVote.upsert({
      where: {
        optionId_userId: { optionId, userId },
      },
      update: {}, // même option = rien à mettre à jour
      create: { optionId, userId },
    });
  }

  async getPoll(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        pollOptions: {
          include: { votes: true },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found');

    if (event.type !== 'POLL')
      throw new ForbiddenException('This event is not a poll');

    // Vérifier membership
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId: event.calendarId },
    });
    if (!membership)
      throw new ForbiddenException('You are not a member of this calendar');

    return event;
  }

  async finalizePoll(userId: string, eventId: string, optionId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1) Vérifier l'événement
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: {
          pollOptions: true,
        },
      });

      if (!event) throw new NotFoundException('Event not found');

      if (event.type !== 'POLL')
        throw new ForbiddenException('This event is not a poll');

      // 2) Vérifier membership
      const membership = await tx.calendarMember.findFirst({
        where: { userId, calendarId: event.calendarId },
      });

      if (!membership)
        throw new ForbiddenException('You are not a member of this calendar');

      // 3) Vérifier rôle (owner/admin uniquement)
      if (membership.role !== 'owner' && membership.role !== 'admin')
        throw new ForbiddenException(
          'Only the owner or an admin can finalize a poll',
        );

      // 4) Vérifier que ce poll n'a pas déjà été finalisé
      if (event.finalizedOptionId)
        throw new ForbiddenException('This poll has already been finalized');

      // 5) Vérifier que l'option appartient à ce poll
      const option = event.pollOptions.find((o) => o.id === optionId);
      if (!option) throw new ForbiddenException('Invalid poll option');

      // 6) Créer l'événement final
      // Si pollType = DATE → label = "2025-12-20 18:00"
      // Si pollType = LOCATION → label = lieu
      const newEvent = await tx.event.create({
        data: {
          title: event.title,
          description: event.description ?? null,
          calendarId: event.calendarId,
          type: 'STANDARD',
          creatorId: userId,

          // Cas DATE : on parse le label → startDateTime
          startDateTime:
            option.optionType === 'DATE'
              ? new Date(option.label)
              : event.startDateTime, // fallback

          endDateTime:
            option.optionType === 'DATE'
              ? new Date(option.label)
              : event.endDateTime,

          // Cas LIEU : on met le label comme location
          location:
            option.optionType === 'LOCATION' ? option.label : event.location,
        },
      });

      // 7) Marquer le poll comme finalisé
      await tx.event.update({
        where: { id: event.id },
        data: {
          finalizedOptionId: optionId,
          finalizedEventId: newEvent.id,
        },
      });

      // 8) Notifier les membres (facultatif mais prêt à l'emploi)
      const members = await tx.calendarMember.findMany({
        where: { calendarId: event.calendarId },
      });
      const userIds = members.map((m) => m.userId);

      await this.notifications.notifyUsers(tx, userIds, {
        type: 'POLL_FINALIZED',
        title: 'Finalisation de sondage !',
        message: `Le sondage "${event.title}" a été finalisé.`,
        eventId: newEvent.id,
      });

      // 9) Retourner la réponse finale
      return {
        message: 'Poll finalized successfully',
        finalEvent: newEvent,
        chosenOption: option,
      };
    });
  }
}
