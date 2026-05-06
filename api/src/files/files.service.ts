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

    if (!hasPremium) {
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
            visibility: eventId ? 'EVENT' : 'CALENDAR',
            uploadedById: userId,
            calendarId,
            eventId,
          },
        });
        this.auditService.log({
          userId,
          action: 'FILE_UPLOAD',
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
        calendar: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!file) throw new NotFoundException('File not found');

    const isUploader = file.uploadedById === userId;
    const isMember = file.calendar?.members.some((m) => m.userId === userId);

    if (!isUploader && !isMember) {
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
}
