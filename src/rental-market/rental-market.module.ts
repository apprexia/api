import { Module } from '@nestjs/common';
import { RentalMarketService } from './rental-market.service';
import { PrismaService } from '../services/prisma/prisma.service';

@Module({
  providers: [RentalMarketService, PrismaService],
  exports: [RentalMarketService],
})
export class RentalMarketModule {}
