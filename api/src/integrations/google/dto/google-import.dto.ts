import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GoogleImportDto {
  @IsString()
  googleEventId!: string;

  @IsUUID()
  calendarId!: string; // MyApp calendar target

  @IsOptional()
  @IsString()
  googleCalendarId?: string; // default: "primary"
}
