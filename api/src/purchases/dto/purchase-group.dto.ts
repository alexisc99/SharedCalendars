import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PurchaseGroupDto {
  @IsString()
  calendarId: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(300)
  seats?: number;

  @IsOptional()
  @IsIn(['monthly', 'annual'])
  period?: 'monthly' | 'annual';
}
