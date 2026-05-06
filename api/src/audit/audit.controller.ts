import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditListQueryDto } from './dto/audit-list-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Audit')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard)
@Controller('audit')
export class AuditController {
  constructor(
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async getAuditLogs(
    @User('sub') userId: string,
    @Query('calendarId') calendarId: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit = '20',
    @Query('cursor') cursor?: string,
  ) {
    if (!calendarId) {
      throw new ForbiddenException('calendarId is required');
    }

    // 🔐 INLINE PERMISSION CHECK (owner/admin only)
    const membership = await this.prisma.calendarMember.findFirst({
      where: {
        userId,
        calendarId,
      },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenException('Access denied');
    }

    return this.auditService.getLogs({
      calendarId,
      entity,
      entityId,
      limit: parseInt(limit, 10),
      cursor,
    });
  }
  @Get('list')
  async listMyAudit(
    @User('sub') userId: string,
    @Query() query: AuditListQueryDto,
  ) {
    return this.auditService.listUserAudit(userId, query);
  }
}
