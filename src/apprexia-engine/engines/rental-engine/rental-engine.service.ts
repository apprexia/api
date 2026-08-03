import { Injectable } from '@nestjs/common';
import { RentalMarketService } from 'src/rental-market/rental-market.service';
import { PropertyType } from '@prisma/client';

@Injectable()
export class RentalEngineService {
    constructor(private readonly rentalMarketService: RentalMarketService) {}

    async compute(context: any) {
        const typeLocal = context.analysis.typeLocal ?? context.metadata.typeLocal ?? '';

        const propertyType = typeLocal.toLowerCase().includes('appartement')
            ? PropertyType.APARTMENT
            : typeLocal.toLowerCase().includes('maison')
              ? PropertyType.HOUSE
              : PropertyType.APARTMENT;

        const rental = await this.rentalMarketService.estimateRent({
            inseeCode: context.metadata.inseeCode ?? context.dvf?.inseeCode ?? null,

            city: context.dvf?.city ?? context.metadata.city ?? context.analysis.city,

            propertyType,

            rooms: context.metadata.rooms ?? context.analysis.rooms ?? null,

            surface: context.metadata.surface ?? context.analysis.surface ?? null,
        });

        console.log('🏠 RENTAL RESULT', rental);

        if (!rental) {
            return {
                estimatedRentMonthly: null,
                estimatedRentLow: null,
                estimatedRentHigh: null,
                rentPerSquareMeter: null,
                rentConfidence: null,
                grossYield: null,
                yieldLevel: 'UNKNOWN',
                yieldAnalysis: 'Données locatives insuffisantes',
            };
        }

        const price = context.analysis.askingPrice ?? context.metadata.price;

        const grossYield = price && rental.monthlyRent ? ((rental.monthlyRent * 12) / price) * 100 : null;

        return {
            // Loyer estimé
            estimatedRentMonthly: rental.monthlyRent,

            estimatedRentLow: rental.lowRent,

            estimatedRentHigh: rental.highRent,

            // Marché locatif
            rentPerSquareMeter: rental.rentPerM2,

            rentConfidence: rental.confidence,

            // Rendement
            grossYield: grossYield !== null ? Number(grossYield.toFixed(2)) : null,

            yieldLevel: this.getYieldLevel(grossYield),

            yieldAnalysis: this.getYieldAnalysis(grossYield),
        };
    }

    private getYieldLevel(yieldValue?: number | null) {
        if (!yieldValue) {
            return 'UNKNOWN';
        }

        if (yieldValue < 3) {
            return 'FAIBLE';
        }

        if (yieldValue < 5) {
            return 'MOYEN';
        }

        if (yieldValue < 8) {
            return 'BON';
        }

        return 'EXCELLENT';
    }

    private getYieldAnalysis(yieldValue?: number | null) {
        if (!yieldValue) {
            return 'Données locatives insuffisantes';
        }

        if (yieldValue < 3) {
            return 'Rentabilité faible pour un investissement locatif';
        }

        if (yieldValue < 5) {
            return 'Rentabilité correcte pour le marché';
        }

        if (yieldValue < 8) {
            return 'Bonne opportunité locative';
        }

        return 'Très forte rentabilité locative';
    }
}
