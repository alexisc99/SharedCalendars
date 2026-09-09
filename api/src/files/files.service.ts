import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { AuditService } from '../audit/audit.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PREMIUM_STORAGE = 500 * 1024 * 1024; // 500 MB

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable()
export class FilesService {
  private uploadDir = path.join(process.cwd(), 'uploads');

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir);
    }
  }

  async uploadFile({
    userId,
    file,
    calendarId,
    eventId,
    purpose,
  }: {
    userId: string;
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    };
    calendarId?: string;
    eventId?: string;
    /** Ex: "cover" — un changement d'apparence, pas un contenu partagé avec
     * le calendrier. Journalisé différemment pour ne pas gonfler la stat
     * d'activité "fichiers" à chaque nouvelle photo de couverture essayée. */
    purpose?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('User does not exist');
    }

    const calendar = calendarId
      ? await this.prisma.calendar.findUnique({
          where: { id: calendarId },
          select: { isPremium: true },
        })
      : null;

    const hasPremium = user.isPremium || calendar?.isPremium === true;

    // La photo de profil est une fonctionnalité de base, pas premium —
    // contrairement à l'image de couverture d'un calendrier ou aux pièces
    // jointes d'un événement.
    if (purpose !== 'avatar' && !hasPremium) {
      throw new ForbiddenException('File upload requires premium');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new ForbiddenException('Unsupported file type');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ForbiddenException('File too large');
    }

    return this.prisma.$transaction(async (tx) => {
      const usedStorage = await tx.file.aggregate({
        where: { uploadedById: userId },
        _sum: { size: true },
      });

      const usedBytes = usedStorage._sum.size ?? 0;

      if (usedBytes + file.size > MAX_PREMIUM_STORAGE) {
        throw new ForbiddenException('Storage quota exceeded');
      }

      const storedPath = path.join(
        this.uploadDir,
        `${Date.now()}-${file.originalname}`,
      );

      try {
        fs.writeFileSync(storedPath, file.buffer);

        const createdFile = await tx.file.create({
          data: {
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            storagePath: storedPath,
            visibility: eventId ? 'EVENT' : calendarId ? 'CALENDAR' : 'PRIVATE',
            uploadedById: userId,
            calendarId,
            eventId,
          },
        });
        this.auditService.log({
          userId,
          // Une image de couverture / de profil n'est pas un contenu partagé
          // avec le calendrier (comme une pièce jointe) — action différente
          // pour ne pas compter dans les stats d'activité "fichiers".
          action:
            purpose === 'cover'
              ? 'COVER_IMAGE_UPLOAD'
              : purpose === 'avatar'
                ? 'AVATAR_UPLOAD'
                : 'FILE_UPLOAD',
          entity: 'File',
          entityId: createdFile.id,
          metadata: {
            calendarId: createdFile.calendarId,
          },
        });
        return createdFile;
      } catch (err) {
        if (fs.existsSync(storedPath)) {
          fs.unlinkSync(storedPath);
        }
        throw err;
      }
    });
  }

  async getFile(fileId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async getFileForUser(userId: string, fileId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        // Une pièce jointe d'événement n'a pas forcément calendarId renseigné
        // (seulement eventId) — on remonte donc aussi jusqu'au calendrier de
        // l'événement pour vérifier l'appartenance.
        event: { select: { calendarId: true } },
      },
    });

    if (!file) throw new NotFoundException('File not found');

    const isUploader = file.uploadedById === userId;

    const calendarId = file.calendarId ?? file.event?.calendarId ?? null;
    const isMember = calendarId
      ? !!(await this.prisma.calendarMember.findFirst({
          where: { calendarId, userId },
          select: { id: true },
        }))
      : false;

    // Une photo de profil est visible par n'importe quel utilisateur connecté
    // (comme dans la plupart des apps) — elle n'est liée à aucun calendrier
    // précis, donc la vérification d'appartenance ci-dessus ne peut jamais
    // s'appliquer pour elle. On vérifie juste qu'il s'agit bien de l'avatar
    // actuel de quelqu'un (et pas d'un fichier orphelin quelconque).
    const isSomeonesAvatar =
      !isUploader && !isMember
        ? await this.prisma.user.findFirst({
            where: { avatarUrl: `/files/${fileId}` },
            select: { id: true },
          })
        : null;

    if (!isUploader && !isMember && !isSomeonesAvatar) {
      throw new ForbiddenException('Access denied');
    }

    return file;
  }

  async deleteFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });
    if (!file) throw new NotFoundException('File not found');

    if (file.uploadedById !== userId) {
      throw new ForbiddenException('You cannot delete this file');
    }

    if (fs.existsSync(file.storagePath)) {
      fs.unlinkSync(file.storagePath);
    }

    const deletedFile = await this.prisma.file.delete({
      where: { id: fileId },
    });
    this.auditService.log({
      userId,
      action: 'FILE_DELETE',
      entity: 'File',
      entityId: deletedFile.id,
      metadata: {
        calendarId: deletedFile.calendarId,
      },
    });
    return {
      success: true,
    };
  }

  /**
   * Suppression "système" d'un fichier (ex: ancienne image de couverture
   * remplacée par une nouvelle) — sans le contrôle de propriété de
   * deleteFile(), car l'appelant a déjà vérifié le droit d'agir sur la
   * ressource parente (le calendrier). Best-effort : ne lève jamais.
   */
  async deleteFileInternal(fileId: string, actingUserId: string) {
    try {
      const file = await this.prisma.file.findUnique({ where: { id: fileId } });
      if (!file) return;

      if (fs.existsSync(file.storagePath)) {
        fs.unlinkSync(file.storagePath);
      }

      await this.prisma.file.delete({ where: { id: fileId } });

      this.auditService.log({
        userId: actingUserId,
        action: 'FILE_DELETE',
        entity: 'File',
        entityId: file.id,
        metadata: { calendarId: file.calendarId, reason: 'cover_image_replaced' },
      });
    } catch (err) {
      console.error('[deleteFileInternal] cleanup failed', fileId, err);
    }
  }
}
