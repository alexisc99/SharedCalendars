import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventType, PollOptionType } from '@prisma/client';

class CreateReminderDto {
  @IsInt()
  @Min(1)
  minutesBefore: number;
}

class CreatePollOptionDto {
  @IsString()
  label: string;
}

export class CreateEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  locationAddress?: string;

  @IsDateString()
  startDateTime: string;

  @IsDateString()
  endDateTime: string;

  @IsOptional()
  @IsEnum(EventType)
  type?: EventType; // STANDARD, ANNIVERSARY, POLL

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReminderDto)
  reminders?: CreateReminderDto[];

  // ------ 🎯 SONDAGES (POLL) ------
  @IsOptional()
  @IsEnum(PollOptionType, {
    message: 'pollType must be DATE or LOCATION',
  })
  pollType?: PollOptionType;

  @IsOptional()
  @ArrayMinSize(2, { message: 'A poll must have at least 2 options' })
  @ArrayMaxSize(10, { message: 'A poll cannot exceed 10 options' })
  @ValidateNested({ each: true })
  @Type(() => CreatePollOptionDto)
  pollOptions?: CreatePollOptionDto[];
}
