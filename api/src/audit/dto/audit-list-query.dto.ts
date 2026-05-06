import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AuditListQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;
}
