import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GoogleEventsQueryDto {
  @IsOptional()
  @IsString()
  googleCalendarId?: string; // default: "primary"

  @IsOptional()
  @IsDateString()
  timeMin?: string;

  @IsOptional()
  @IsDateString()
  timeMax?: string;

  @IsOptional()
  @IsString()
  pageToken?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(2500)
  maxResults?: number;
}
