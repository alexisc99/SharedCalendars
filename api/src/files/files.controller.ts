import {
  Controller,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Query,
  Get,
  Param,
  Res,
  Delete,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { FilesService } from './files.service';
import { User } from '../auth/decorators/user.decorator';
import type { Response } from 'express';
import * as fs from 'fs';

@UseGuards(AuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @User('sub') userId: string,
    @UploadedFile() file: any,
    @Query('calendarId') calendarIdQuery?: string,
    @Body('calendarId') calendarIdBody?: string,
    @Query('eventId') eventIdQuery?: string,
    @Body('eventId') eventIdBody?: string,
    @Query('purpose') purposeQuery?: string,
    @Body('purpose') purposeBody?: string,
  ) {
    const calendarId = calendarIdQuery ?? calendarIdBody;
    const eventId = eventIdQuery ?? eventIdBody;
    const purpose = purposeQuery ?? purposeBody;

    const result = await this.filesService.uploadFile({
      userId,
      file,
      calendarId,
      eventId,
      purpose,
    });
    return {
      success: true,
      id: result.id,
      data: result,
    };
  }

  @Get(':id')
  async download(
    @User('sub') userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.filesService.getFileForUser(userId, id);

    res.setHeader('Content-Type', file.mimeType);
    fs.createReadStream(file.storagePath).pipe(res);
  }

  @Delete(':id')
  delete(@User('sub') userId: string, @Param('id') id: string) {
    return this.filesService.deleteFile(userId, id);
  }
}
