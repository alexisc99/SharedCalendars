import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerIpGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const headers = (req?.headers ?? {}) as Record<string, any>;

    const xff = headers['x-forwarded-for'];
    const firstXff =
      typeof xff === 'string'
        ? xff.split(',')[0].trim()
        : Array.isArray(xff)
          ? String(xff[0] ?? '')
              .split(',')[0]
              .trim()
          : '';

    const ip =
      firstXff ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      req?.connection?.remoteAddress ||
      'unknown';

    return String(ip);
  }
}
