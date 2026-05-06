import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogInput } from './audit.types';
import { AuditListQueryDto } from './dto/audit-list-query.dto';
import { assertValidRange } from '../common/utils/date-range';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          metadata: input.metadata,
        },
      });
    } catch (err) {
      // Best effort: never throw
      console.error('[AUDIT_LOG_ERROR]', err);
    }
  }
  async getLogs({
    calendarId,
    entity,
    entityId,
    limit,
    cursor,
  }: {
    calendarId: string;
    entity?: string;
    entityId?: string;
    limit: number;
    cursor?: string;
  }) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(entityId ? { entityId } : {}),
        metadata: {
          path: ['calendarId'],
          equals: calendarId,
        },
      },
      take: limit,
      skip: cursor ? 1 : 0,
      ...(cursor && { cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
    });
  }

  async listUserAudit(userId: string, query: AuditListQueryDto) {
    assertValidRange(query.from, query.to);
    const limit = query.limit ?? 50;

    const where: any = { userId };

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const items = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });

    const hasNext = items.length > limit;
    const page = hasNext ? items.slice(0, limit) : items;

    return {
      items: page,
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }
}
