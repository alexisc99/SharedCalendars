import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RsvpDto } from './dto/rsvp.dto';

@Injectable()
export class RsvpService {
  constructor(private prisma: PrismaService) {}

  async respondToEvent(userId: string, eventId: string, dto: RsvpDto) {
    // Vérifier que l'événement existe
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');

    // Vérifier que l'utilisateur est membre du calendrier
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId: event.calendarId },
    });
    if (!membership)
      throw new ForbiddenException('You are not a member of this calendar');
    // Si event pending → personne ne peut RSVP sauf owner/admin
    if (
      event.status === 'PENDING' &&
      membership.role !== 'owner' &&
      membership.role !== 'admin'
    ) {
      throw new ForbiddenException('Cannot RSVP to a pending event');
    }

    // viewer = lecture seule
    if (membership.role === 'viewer')
      throw new ForbiddenException('You cannot RSVP to this event');

    // Événement déjà passé → RSVP figé
    if (event.endDateTime.getTime() < Date.now()) {
      throw new BadRequestException('Cannot RSVP to a past event');
    }

    // Mettre à jour ou créer l'RSVP
    return this.prisma.eventRsvp.upsert({
      where: {
        eventId_userId: { eventId, userId },
      },
      update: { status: dto.status, updatedAt: new Date() },
      create: { eventId, userId, status: dto.status },
    });
  }

  async listRsvps(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');

    // Vérifier membership
    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId: event.calendarId },
    });
    if (!membership)
      throw new ForbiddenException('You are not a member of this calendar');

    // viewer peut lire → OK
    return this.prisma.eventRsvp.findMany({
      where: { eventId },
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
