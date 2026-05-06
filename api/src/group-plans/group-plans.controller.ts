import {
  Controller,
  Post,
  Body,
  UseGuards,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { GroupPlansService } from './group-plans.service';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';

@Controller('group-plans')
export class GroupPlansController {
  constructor(private readonly groupPlansService: GroupPlansService) {}

  /**
   * DEV ONLY
   * Simule l’achat d’un plan famille/groupe
   */
  @UseGuards(AuthGuard)
  @Post('dev/provision')
  async provisionDev(
    @User('sub') userId: string,
    @Body('seats') seats?: number,
  ) {
    const result = await this.groupPlansService.provisionDev(
      userId,
      seats ?? 6,
    );
    return {
      success: true,
      id: result.planId,
      data: result,
    };
  }

  @UseGuards(AuthGuard)
  @Post('dev/:planId/downgrade')
  async downgrade(
    @Param('planId') planId: string,
    @User('sub') userId: string,
  ) {
    // Sécurité minimale : seul l’owner du plan devrait pouvoir appeler
    // (on pourra renforcer plus tard)
    const result = await this.groupPlansService.downgrade(planId);
    return {
      success: true,
      id: result.planId,
      data: result,
    };
  }

  /**
   * DEV ONLY
   * Renew a plan (simulate payment / renewal)
   */
  @UseGuards(AuthGuard)
  @Post('dev/:planId/renew')
  async renewDev(
    @User('sub') userId: string,
    @Param('planId') planId: string,
    @Body() body: { expiresAt?: string; seats?: number },
  ) {
    if (!body?.expiresAt) {
      throw new ForbiddenException('expiresAt is required (ISO string)');
    }

    const newExpiresAt = new Date(body.expiresAt);

    const result = await this.groupPlansService.renew({
      planId,
      renewedByUserId: userId,
      newExpiresAt,
      newSeats: body.seats,
    });
    return {
      success: true,
      id: result.planId,
      data: result,
    };
  }
}
