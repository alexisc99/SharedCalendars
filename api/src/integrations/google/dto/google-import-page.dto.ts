import { IsUUID } from 'class-validator';
import { GoogleEventsQueryDto } from './google-events-query.dto';

export class GoogleImportPageDto extends GoogleEventsQueryDto {
  @IsUUID()
  calendarId!: string; // MyApp calendar target
}
