import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { PrismaModule } from '../prisma.module';
import { PublicIcsController } from './public-ics.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ExportsController, PublicIcsController],
  providers: [ExportsService],
})
export class ExportsModule {}
