import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCalendarDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}
