import { Injectable } from '@nestjs/common';

import { EngineContext } from '../../interfaces/engine-context.interface';
import { MarketPosition } from '../../interfaces/market-position.interface';

@Injectable()
export class MarketPositionEngineService {
    compute(context: EngineContext): MarketPosition {
        const { askingPrice, estimatedValueLow, estimatedValueHigh, valuation } = context.analysis;

        if (!askingPrice || askingPrice <= 0) {
            return 'PRIX MARCHE';
        }

        // =====================================================
        // VALEUR CENTRALE APPREXIA
        // =====================================================
        //
        // Priorité :
        //
        // 1. adjustedValue
        // 2. milieu de la fourchette
        // 3. fallback DVF
        //
        // L'objectif est que tous les moteurs travaillent
        // sur la même valorisation.
        //
        // =====================================================

        const referenceValue =
            valuation?.adjustedValue ??
            (estimatedValueLow && estimatedValueHigh ? (estimatedValueLow + estimatedValueHigh) / 2 : 0);

        if (!referenceValue || referenceValue <= 0) {
            return 'PRIX MARCHE';
        }

        // =====================================================
        // ÉCART PAR RAPPORT À LA VALEUR APPREXIA
        // =====================================================

        const delta = ((askingPrice - referenceValue) / referenceValue) * 100;

        // =====================================================
        // SOUS-ÉVALUÉ
        // =====================================================

        if (delta <= -10) {
            return 'SOUS EVALUE';
        }

        // =====================================================
        // PRIX MARCHÉ
        // =====================================================

        if (delta <= 5) {
            return 'PRIX MARCHE';
        }

        // =====================================================
        // LÉGÈREMENT SURCOTÉ
        // =====================================================

        if (delta <= 15) {
            return 'LEGEREMENT SURCOTE';
        }

        // =====================================================
        // SURCOTÉ
        // =====================================================

        return 'SURCOTE';
    }
}
