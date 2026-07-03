import { Injectable } from '@nestjs/common';
import { PrismaService } from '../services/prisma/prisma.service';

@Injectable()
export class DvfService {
  constructor(private prisma: PrismaService) {}

  async getMarketData(commune: string, typeLocal: string, surface: number) {
    const normalizedCommune = commune.trim().toUpperCase();

    const normalizedType = typeLocal?.toLowerCase().includes('appartement')
      ? 'Appartement'
      : typeLocal?.toLowerCase().includes('maison')
        ? 'Maison'
        : null;

    const minSurface = surface * 0.5;
    const maxSurface = surface * 1.8;

    const transactions = await this.prisma.dvfTransaction.findMany({
      where: {
        commune: {
          equals: normalizedCommune,
          mode: 'insensitive',
        },
        ...(normalizedType && { typeLocal: normalizedType }),
        surface: {
          gte: minSurface,
          lte: maxSurface,
        },
      },
      take: 1000,
    });

    const valid = transactions.filter((t) => t.prixM2 && t.prixM2 > 0);

    if (!valid.length) {
      return {
        count: 0,
        averagePriceM2: 0,
        estimatedValue: 0,
      };
    }

    const average = valid.reduce((sum, t) => sum + t.prixM2, 0) / valid.length;

    return {
      count: valid.length,
      averagePriceM2: Math.round(average),
      estimatedValue: Math.round(average * surface),
    };
  }
}
