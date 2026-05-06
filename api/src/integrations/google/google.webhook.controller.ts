import { Controller, Headers, Post } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GoogleService } from './google.service';
@Controller('integrations/google')
export class GoogleWebhookController {
  constructor(
    private googleService: GoogleService,
    private prisma: PrismaService,
  ) {}
  @Post('webhook')
  async handleWebhook(@Headers('x-goog-channel-id') channelId: string) {
    const channel = await this.prisma.googleWatchChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) return 'OK';

    return 'OK';
  }
}
