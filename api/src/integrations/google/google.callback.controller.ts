import {
  Controller,
  Get,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { GoogleService } from './google.service';
import type { Response } from 'express';

@Controller('integrations/google')
export class GoogleCallbackController {
  constructor(private readonly googleService: GoogleService) {}

  @Get('callback')
  async callback(
    @Query('state') state: string,
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    if (!state || !code) {
      throw new UnauthorizedException();
    }

    await this.googleService.handleOAuthCallback(state, code);
    // state contient returnUrl
    const returnUrl = this.googleService.decodeState(state);

    // fallback si jamais (sécurité)
    if (!returnUrl) return res.redirect('mobile://oauth/success');

    return res.redirect(returnUrl);
  }
}
