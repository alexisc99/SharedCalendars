import { IsBoolean, IsString } from 'class-validator';

export class NotificationPreferenceDto {
  @IsString()
  type!: string; // EVENT_CREATED, COMMENT_ADDED, etc.

  @IsBoolean()
  enabled!: boolean;
}
