import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth('jwt')
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@User('sub') userId: string) {
    return this.usersService.getMe(userId);
  }

  @Patch('me')
  async updateMe(@Req() req, @Body() body) {
    const result = await this.usersService.updateMe(req.user.userId, body);
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }
}
