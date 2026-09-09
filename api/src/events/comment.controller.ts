import {
  Controller,
  UseGuards,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { CommentService } from './comment.service';
import { CommentDto } from './dto/comment.dto';

@UseGuards(AuthGuard)
@Controller('events/:eventId/comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  async addComment(
    @User('sub') userId: string,
    @Param('eventId') eventId: string,
    @Body() dto: CommentDto,
  ) {
    const result = await this.commentService.addComment(userId, eventId, dto);
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }

  @Get()
  getComments(@User('sub') userId: string, @Param('eventId') eventId: string) {
    return this.commentService.getComments(userId, eventId);
  }

  @Patch(':commentId')
  async editComment(
    @User('sub') userId: string,
    @Param('commentId') commentId: string,
    @Body() dto: CommentDto,
  ) {
    const result = await this.commentService.editComment(
      userId,
      commentId,
      dto.text,
    );
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }

  @Delete(':commentId')
  deleteComment(
    @User('sub') userId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.commentService.deleteComment(userId, commentId);
  }
}
