import { IsString } from 'class-validator';

export class CommentDto {
  @IsString()
  text: string;
}
