import { Injectable } from '@nestjs/common';

import { EngineContext } from '../../interfaces/engine-context.interface';

export interface RecommendationResult {
    recommendedPrice: number;
    negotiationAmount: number;
    negotiationPotential: number;
}

@Injectable()
export class RecommendedPriceEngineService {
    compute(context: EngineContext): RecommendationResult {
        const { askingPrice, estimatedValueLow, estimatedValueHigh, valuation } = context.analysis;

        // =====================================================
        // DONNÉES INSUFFISANTES
        // =====================================================

        if (!askingPrice || askingPrice <= 0) {
            return {
                recommendedPrice: 0,
                negotiationAmount: 0,
                negotiationPotential: 0,
            };
        }

        // =====================================================
        // VALEUR CENTRALE APPREXIA
        // =====================================================

        const marketValue =
            valuation?.adjustedValue ??
            (estimatedValueLow && estimatedValueHigh ? (estimatedValueLow + estimatedValueHigh) / 2 : 0);

        if (!marketValue || marketValue <= 0) {
            return {
                recommendedPrice: askingPrice,
                negotiationAmount: 0,
                negotiationPotential: 0,
            };
        }

        // =====================================================
        // ÉCART DU PRIX DEMANDÉ
        // =====================================================

        const delta = ((askingPrice - marketValue) / marketValue) * 100;

        let recommendedPrice = askingPrice;

        // =====================================================
        // 1. SOUS-ÉVALUÉ
        // =====================================================
        //
        // Le vendeur demande moins que la valeur Apprexia.
        //
        // On ne va pas conseiller de payer davantage.
        //
        // =====================================================

        if (delta <= -10) {
            recommendedPrice = askingPrice;
        }

        // =====================================================
        // 2. PRIX COHÉRENT
        // =====================================================
        //
        // Jusqu'à +5 %, on considère que le prix reste
        // suffisamment proche de la valeur théorique.
        //
        // =====================================================
        else if (delta <= 5) {
            recommendedPrice = askingPrice;
        }

        // =====================================================
        // 3. SURCOTE
        // =====================================================
        //
        // Dès que le prix dépasse significativement la valeur
        // Apprexia, la recommandation revient vers la valeur
        // centrale ajustée.
        //
        // =====================================================
        else {
            recommendedPrice = Math.round(marketValue);
        }

        // =====================================================
        // SÉCURITÉ
        // =====================================================

        recommendedPrice = Math.min(recommendedPrice, askingPrice);

        recommendedPrice = Math.max(0, Math.round(recommendedPrice));

        // =====================================================
        // NÉGOCIATION
        // =====================================================

        const negotiationAmount = Math.max(0, askingPrice - recommendedPrice);

        let negotiationPotential = askingPrice > 0 ? (negotiationAmount / askingPrice) * 100 : 0;

        // =====================================================
        // PETITE NÉGOCIATION
        // =====================================================

        if (negotiationPotential < 3) {
            negotiationPotential = 0;
        }

        return {
            recommendedPrice,

            negotiationAmount: negotiationPotential === 0 ? 0 : Math.round(negotiationAmount),

            negotiationPotential: Math.round(negotiationPotential * 10) / 10,
        };
    }
}
