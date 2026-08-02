import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { PropertyType, RoomCategory, RentalMarket } from '@prisma/client';

import { RentalEstimate } from './interfaces/rental-estimate.interface';

@Injectable()
export class RentalMarketService {
  constructor(private readonly prisma: PrismaService) {}

  async estimateRent(params: {
    inseeCode?: string;

    city?: string;

    propertyType: PropertyType;

    rooms?: number;

    surface: number;
  }): Promise<RentalEstimate | null> {
    const roomCategory = this.getRoomCategory(params.rooms);

    let rental: RentalMarket | null = null;

    // 1️⃣ Recherche précise par code INSEE
    if (params.inseeCode) {
      rental = await this.prisma.rentalMarket.findFirst({
        where: {
          inseeCode: params.inseeCode,
          propertyType: params.propertyType,
          roomCategory,
        },
      });
    }

    // 2️⃣ Fallback par ville
    if (!rental && params.city) {
      rental = await this.prisma.rentalMarket.findFirst({
        where: {
          city: {
            contains: params.city,
            mode: 'insensitive',
          },

          propertyType: params.propertyType,

          roomCategory,
        },

        orderBy: {
          adjustedR2: 'desc',
        },
      });
    }

    // aucune donnée trouvée
    if (!rental) {
      return null;
    }

    const monthlyRent = params.surface * rental.rentMedianM2;

    return {
      rentPerM2: rental.rentMedianM2,

      monthlyRent: Math.round(monthlyRent),

      lowRent: Math.round(params.surface * rental.rentLowM2),

      highRent: Math.round(params.surface * rental.rentHighM2),

      confidence: rental.adjustedR2,

      source: rental.predictionType,
    };
  }

  private getRoomCategory(rooms?: number): RoomCategory {
    if (!rooms) {
      return RoomCategory.ALL;
    }

    if (rooms <= 2) {
      return RoomCategory.ONE_TWO;
    }

    return RoomCategory.THREE_PLUS;
  }
}
