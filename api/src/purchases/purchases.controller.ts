import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { PurchasesService } from './purchases.service';
import { PurchaseGroupDto } from './dto/purchase-group.dto';

@ApiTags('Purchases')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private purchasesService: PurchasesService) {}

  @Get('plans')
  getPlans() {
    return this.purchasesService.getPlans();
  }

  @Get('me')
  getMyStatus(@User('sub') userId: string) {
    return this.purchasesService.getMyStatus(userId);
  }

  @Post('trial')
  startTrial(@User('sub') userId: string) {
    return this.purchasesService.startTrial(userId);
  }

  @Post('individual')
  purchaseIndividual(@User('sub') userId: string) {
    return this.purchasesService.purchaseIndividual(userId);
  }

  @Delete('individual')
  cancelIndividual(@User('sub') userId: string) {
    return this.purchasesService.cancelIndividual(userId);
  }

  @Post('group')
  purchaseGroup(@User('sub') userId: string, @Body() dto: PurchaseGroupDto) {
    return this.purchasesService.purchaseGroup(
      userId,
      dto.calendarId,
      dto.seats,
      dto.period,
    );
  }

  @Delete('group/:calendarId')
  cancelGroup(
    @User('sub') userId: string,
    @Param('calendarId') calendarId: string,
  ) {
    return this.purchasesService.cancelGroup(userId, calendarId);
  }
}
