import { Module } from '@nestjs/common';
import { DvfService } from './dvf.service';
import { DvfController } from './dvf.controller';
import { PrismaService } from '../services/prisma/prisma.service';

@Module({
  providers: [DvfService, PrismaService],
  controllers: [DvfController],
  exports: [DvfService],
})
export class DvfModule {}
