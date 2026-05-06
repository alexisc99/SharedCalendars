import { ValidateNested, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationPreferenceDto } from './notification-preference.dto';

export class UpdateNotificationPreferencesDto {
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceDto)
  preferences!: NotificationPreferenceDto[];
}
