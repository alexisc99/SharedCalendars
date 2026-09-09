import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { AuditListQueryDto } from './dto/audit-list-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Le journal calendrier-entier (qui a supprimé quoi, visible par owner/admin)
// a été retiré volontairement : ça exposait le contenu et l'auteur de
// commentaires/fichiers supprimés à d'autres membres, ce qui va à l'encontre
// de l'attente légitime qu'un message retiré à chaud reste privé. Seul
// l'historique de ses propres actions reste consultable (ci-dessous).
@ApiTags('Audit')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('list')
  async listMyAudit(
    @User('sub') userId: string,
    @Query() query: AuditListQueryDto,
  ) {
    return this.auditService.listUserAudit(userId, query);
  }
}
