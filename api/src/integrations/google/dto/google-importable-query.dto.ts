import { IsUUID } from 'class-validator';
import { GoogleEventsQueryDto } from './google-events-query.dto';

export class GoogleImportableQueryDto extends GoogleEventsQueryDto {
  @IsUUID()
  calendarId!: string; // MyApp calendar target (needed for per-calendar anti-duplicate)
}
