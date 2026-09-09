import { IsString } from 'class-validator';

export class SetMyThemeDto {
  @IsString()
  theme: string;
}
