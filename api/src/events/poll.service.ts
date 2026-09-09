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

  /** Vérifications communes à vote() et unvote() : poll valide + membre autorisé à voter. */
  private async checkVotable(userId: string, eventId: string, optionId: string) {
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

    return event;
  }

  async vote(userId: string, eventId: string, optionId: string) {
    const event = await this.checkVotable(userId, eventId, optionId);

    // Sondage à choix unique : voter pour une nouvelle option retire
    // automatiquement le(s) vote(s) précédent(s) de l'utilisateur sur les
    // autres options de ce même sondage.
    const otherOptionIds = event.pollOptions
      .map((o) => o.id)
      .filter((id) => id !== optionId);

    return this.prisma.$transaction(async (tx) => {
      if (otherOptionIds.length > 0) {
        await tx.pollVote.deleteMany({
          where: { userId, optionId: { in: otherOptionIds } },
        });
      }
      return tx.pollVote.upsert({
        where: {
          optionId_userId: { optionId, userId },
        },
        update: {}, // même option = rien à mettre à jour
        create: { optionId, userId },
      });
    });
  }

  /** Retire son vote pour une option — permet de désélectionner son choix. */
  async unvote(userId: string, eventId: string, optionId: string) {
    await this.checkVotable(userId, eventId, optionId);

    await this.prisma.pollVote.deleteMany({
      where: { userId, optionId },
    });

    return { success: true };
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

      // 4) Vérifier que l'option appartient à ce poll
      // (pas besoin de vérifier "déjà finalisé" séparément : l'événement
      // sondage est supprimé dès qu'il est finalisé, donc un 2e appel sur le
      // même id tombera naturellement sur "Event not found" à l'étape 1.)
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

      // 7) Transférer les pièces jointes déjà postées sur le sondage vers
      // l'événement final (sinon elles seraient orphelines : eventId pointe
      // vers une ligne qui va être supprimée, et File.eventId passe à NULL
      // via la contrainte ON DELETE SET NULL — le fichier resterait sur le
      // disque sans plus jamais être rattachable ni nettoyé).
      await tx.file.updateMany({
        where: { eventId: event.id },
        data: { eventId: newEvent.id, calendarId: event.calendarId },
      });

      // 8) Supprimer l'événement sondage : une fois finalisé, il ferait
      // doublon avec l'événement final (même titre) et nuirait à la
      // lisibilité. Les rappels/RSVP/commentaires/options de vote qui lui
      // sont propres partent avec lui (ON DELETE CASCADE) — ils concernaient
      // la question posée, pas l'événement final qui en résulte.
      await tx.event.delete({ where: { id: event.id } });

      // 9) Notifier les membres (facultatif mais prêt à l'emploi)
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

      // 10) Retourner la réponse finale
      return {
        message: 'Poll finalized successfully',
        finalEvent: newEvent,
        chosenOption: option,
      };
    });
  }
}
