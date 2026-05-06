import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Put,
  Body,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsListQueryDto } from './dto/notifications-list-query.dto';

@ApiTags('Notifications')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@User('sub') userId: string) {
    return this.notificationsService.listForUser(userId);
  }

  @Get('list')
  async listNotifications(
    @User('sub') userId: string,
    @Query() query: NotificationsListQueryDto,
  ) {
    return this.notificationsService.listUserNotifications(userId, query);
  }

  @Patch(':id/read')
  markAsRead(@User('sub') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @UseGuards(AuthGuard)
  @Get('preferences')
  async getMyPreferences(@User('sub') userId: string) {
    return this.notificationsService.getUserPreferences(userId);
  }

  @UseGuards(AuthGuard)
  @Put('preferences')
  async updateMyPreferences(
    @User('sub') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updateUserPreferences(userId, dto);
  }
}
