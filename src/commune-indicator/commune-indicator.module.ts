import { Module } from '@nestjs/common';
import { CommuneIndicatorService } from './commune-indicator.service';
import { CommuneIndicatorController } from './commune-indicator.controller';
import { PrismaModule } from '../services/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CommuneIndicatorService],
  controllers: [CommuneIndicatorController],
  exports: [CommuneIndicatorService],
})
export class CommuneIndicatorModule {}
