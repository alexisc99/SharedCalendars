import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommentDto } from './dto/comment.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
@Injectable()
export class CommentService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private auditService: AuditService,
  ) {}

  // CREATE COMMENT
  async addComment(userId: string, eventId: string, dto: CommentDto) {
    // Vérifier que l'événement existe
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

    // viewer peut commenter → MVP
    const created = await this.prisma.comment.create({
      data: {
        eventId,
        userId,
        text: dto.text,
      },
      include: {
        // select ciblé : "user: true" renverrait aussi le hash du mot de
        // passe dans la réponse de l'API.
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            isPremium: true,
            createdAt: true,
          },
        },
        event: true,
      },
    });

    this.auditService.log({
      userId,
      action: 'COMMENT_CREATE',
      entity: 'Comment',
      entityId: created.id,
      metadata: {
        eventId,
        calendarId: created.event.calendarId,
      },
    });

    // Récupérer les membres du calendrier
    const members = await this.prisma.calendarMember.findMany({
      where: { calendarId: created.event.calendarId },
    });

    // Notifier tous les membres sauf l'auteur du commentaire
    const targetUserIds = members
      .map((m) => m.userId)
      .filter((id) => id !== userId);

    await this.notifications.notifyUsers(targetUserIds, {
      type: 'COMMENT_ADDED',
      title: `Nouveau commentaire sur "${created.event.title}"`,
      message: created.text,
      eventId: created.eventId,
    });
    return created;
  }

  // LIST COMMENTS
  async getComments(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId: event.calendarId },
    });
    if (!membership)
      throw new ForbiddenException('You are not a member of this calendar');

    return this.prisma.comment.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            isPremium: true,
            createdAt: true,
          },
        },
        deletedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // EDIT COMMENT — seul l'auteur peut réécrire son propre message (contrairement
  // à la suppression, ça n'a pas de sens qu'un admin réécrive les mots de
  // quelqu'un d'autre).
  async editComment(userId: string, commentId: string, text: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.deletedAt)
      throw new ForbiddenException('This comment has been deleted');
    if (comment.userId !== userId)
      throw new ForbiddenException('You can only edit your own comments');

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { text, editedAt: new Date() },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            isPremium: true,
            createdAt: true,
          },
        },
      },
    });
  }

  // DELETE COMMENT
  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        event: true,
        user: true,
      },
    });

    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.deletedAt) return { success: true }; // déjà supprimé, idempotent

    const membership = await this.prisma.calendarMember.findFirst({
      where: { userId, calendarId: comment.event.calendarId },
    });
    if (!membership)
      throw new ForbiddenException('You are not a member of this calendar');

    const role = membership.role;

    // Règles : owner, admin peuvent supprimer
    // créateur du commentaire peut supprimer son propre commentaire
    if (role !== 'owner' && role !== 'admin' && comment.userId !== userId) {
      throw new ForbiddenException('You cannot delete this comment');
    }

    // Suppression douce : on garde la ligne (position dans la conversation,
    // auteur) mais on vide le contenu — sinon un utilisateur qui retire un
    // message à chaud dans une discussion à plusieurs laisserait un trou
    // incompréhensible ("il répond à quoi ?"). Le texte original n'est pas
    // conservé : une fois supprimé, le contenu est vraiment parti, seul le
    // fait qu'un message a existé (et par qui il a été retiré) reste visible.
    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        text: '',
        deletedAt: new Date(),
        deletedById: userId,
      },
    });

    this.auditService.log({
      userId,
      action: 'COMMENT_DELETE',
      entity: 'Comment',
      entityId: commentId,
      metadata: {
        eventId: comment.eventId,
        calendarId: comment.event.calendarId,
      },
    });

    return { success: true };
  }
}
