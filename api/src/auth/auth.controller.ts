import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';

@SkipThrottle()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    const result = await this.authService.signup(dto);
    return {
      success: true,
      id: result.user.id,
      data: result,
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      id: result.user.id,
      data: result,
    };
  }
  @Post('login-cookie')
  async loginCookie(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    // Ton AuthService.login() attend 1 seul argument (d'après TS2554)
    // et renvoie { access_token, user } (d'après TS2339)
    const result = await this.authService.login(body);

    const token = result.access_token;

    res.cookie('access_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // prod HTTPS => true
      maxAge: 1000 * 60 * 60 * 24, // 24h
      path: '/',
    });

    return { ok: true, user: result.user };
  }
}
