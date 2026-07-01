import { Injectable } from '@nestjs/common';
import { PrismaService } from '../services/prisma/prisma.service';

@Injectable()
export class DvfService {
  constructor(private prisma: PrismaService) {}

  async getMarketData(commune: string, typeLocal: string, surface: number) {
    const minSurface = surface * 0.7;
    const maxSurface = surface * 1.3;

    const transactions = await this.prisma.dvfTransaction.findMany({
      where: {
        commune,
        typeLocal,

        surface: {
          gte: minSurface,
          lte: maxSurface,
        },
      },

      take: 1000,
    });

    if (!transactions.length) {
      return null;
    }

    const average =
      transactions.reduce((sum, t) => sum + t.prixM2, 0) / transactions.length;

    return {
      count: transactions.length,

      averagePriceM2: Math.round(average),

      estimatedValue: Math.round(average * surface),
    };
  }
}
