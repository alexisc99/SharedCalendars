import { IsOptional, IsString } from 'class-validator';

export class GoogleExportDto {
  @IsOptional()
  @IsString()
  googleCalendarId?: string; // default: "primary"
}
