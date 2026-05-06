import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, IsString } from 'class-validator';

export class EventDetailQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  commentsLimit?: number;

  @IsOptional()
  @IsString()
  commentsCursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  filesLimit?: number;

  @IsOptional()
  @IsString()
  filesCursor?: string;
}
