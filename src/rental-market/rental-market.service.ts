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

        console.log('🏠 RENTAL SEARCH', {
            inseeCode: params.inseeCode,
            city: params.city,
            propertyType: params.propertyType,
            rooms: params.rooms,
            roomCategory,
            surface: params.surface,
        });

        let rental: RentalMarket | null = null;

        // ==========================================
        // 1. INSEE + TYPE + CATÉGORIE PRÉCISE
        // ==========================================

        if (params.inseeCode) {
            rental = await this.prisma.rentalMarket.findFirst({
                where: {
                    inseeCode: params.inseeCode,
                    propertyType: params.propertyType,
                    roomCategory,
                },
                orderBy: [
                    {
                        year: 'desc',
                    },
                    {
                        adjustedR2: 'desc',
                    },
                ],
            });

            if (rental) {
                console.log('✅ RENTAL FOUND - INSEE + ROOM CATEGORY', rental);
            }
        }

        // ==========================================
        // 2. INSEE + TYPE + ALL
        // ==========================================

        if (!rental && params.inseeCode && roomCategory !== RoomCategory.ALL) {
            rental = await this.prisma.rentalMarket.findFirst({
                where: {
                    inseeCode: params.inseeCode,
                    propertyType: params.propertyType,
                    roomCategory: RoomCategory.ALL,
                },
                orderBy: [
                    {
                        year: 'desc',
                    },
                    {
                        adjustedR2: 'desc',
                    },
                ],
            });

            if (rental) {
                console.log('✅ RENTAL FOUND - INSEE + ALL', rental);
            }
        }

        // ==========================================
        // 3. VILLE + TYPE + CATÉGORIE PRÉCISE
        // ==========================================

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
                orderBy: [
                    {
                        year: 'desc',
                    },
                    {
                        adjustedR2: 'desc',
                    },
                ],
            });

            if (rental) {
                console.log('✅ RENTAL FOUND - CITY + ROOM CATEGORY', rental);
            }
        }

        // ==========================================
        // 4. VILLE + TYPE + ALL
        // ==========================================

        if (!rental && params.city && roomCategory !== RoomCategory.ALL) {
            rental = await this.prisma.rentalMarket.findFirst({
                where: {
                    city: {
                        contains: params.city,
                        mode: 'insensitive',
                    },
                    propertyType: params.propertyType,
                    roomCategory: RoomCategory.ALL,
                },
                orderBy: [
                    {
                        year: 'desc',
                    },
                    {
                        adjustedR2: 'desc',
                    },
                ],
            });

            if (rental) {
                console.log('✅ RENTAL FOUND - CITY + ALL', rental);
            }
        }

        // ==========================================
        // 5. AUCUNE DONNÉE
        // ==========================================

        if (!rental) {
            console.log('❌ NO RENTAL DATA FOUND', {
                inseeCode: params.inseeCode,
                city: params.city,
                propertyType: params.propertyType,
                roomCategory,
            });

            return null;
        }

        // ==========================================
        // CALCUL DU LOYER
        // ==========================================

        const monthlyRent = params.surface * rental.rentMedianM2;
        const lowRent = params.surface * rental.rentLowM2;
        const highRent = params.surface * rental.rentHighM2;

        console.log('🏠 RENTAL ESTIMATE', {
            surface: params.surface,
            rentPerM2: rental.rentMedianM2,
            monthlyRent: Math.round(monthlyRent),
            lowRent: Math.round(lowRent),
            highRent: Math.round(highRent),
            confidence: rental.adjustedR2,
            source: rental.predictionType,
            year: rental.year,
            roomCategoryUsed: rental.roomCategory,
        });

        return {
            rentPerM2: rental.rentMedianM2,
            monthlyRent: Math.round(monthlyRent),
            lowRent: Math.round(lowRent),
            highRent: Math.round(highRent),
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
