import { Injectable } from '@nestjs/common';

@Injectable()
export class OpportunityEngineService {
    compute(
        askingPrice: number,
        estimatedValueLow: number,
        estimatedValueHigh: number,
        dvfReferenceValue?: number | null,
        confidence?: number | null,
    ): number {
        const referenceValue = dvfReferenceValue ?? (estimatedValueLow + estimatedValueHigh) / 2;

        if (!referenceValue || !askingPrice) {
            return 0;
        }

        // Ecart entre prix demandé et valeur marché
        const delta = ((referenceValue - askingPrice) / referenceValue) * 100;

        let opportunity = 0;

        // =====================================
        // POSITION PRIX
        // =====================================

        if (delta >= 25) {
            opportunity = 40;
        } else if (delta >= 15) {
            opportunity = 35;
        } else if (delta >= 5) {
            opportunity = 30;
        } else if (delta >= -5) {
            opportunity = 25;
        } else if (delta >= -15) {
            opportunity = 18;
        } else if (delta >= -25) {
            opportunity = 10;
        } else {
            opportunity = 5;
        }

        // =====================================
        // FIABILITE DVF
        // =====================================

        if (confidence !== null && confidence !== undefined) {
            if (confidence >= 80) {
                opportunity += 3;
            } else if (confidence >= 60) {
                opportunity += 2;
            }
        }

        return Math.min(Math.round(opportunity), 40);
    }
}
