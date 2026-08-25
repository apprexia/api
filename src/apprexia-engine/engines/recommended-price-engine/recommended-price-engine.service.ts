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
        const { askingPrice, estimatedValueLow, estimatedValueHigh, dvfReferenceValue } = context.analysis;

        // =====================================================
        // DONNÉES INSUFFISANTES
        // =====================================================

        if (!askingPrice || !estimatedValueLow || !estimatedValueHigh) {
            return {
                recommendedPrice: askingPrice ?? 0,
                negotiationAmount: 0,
                negotiationPotential: 0,
            };
        }

        const marketValue = dvfReferenceValue ?? (estimatedValueLow + estimatedValueHigh) / 2;

        if (!marketValue || marketValue <= 0) {
            return {
                recommendedPrice: askingPrice,
                negotiationAmount: 0,
                negotiationPotential: 0,
            };
        }

        let recommendedPrice = askingPrice;

        // =====================================================
        // 1. BIEN SOUS-ÉVALUÉ
        // =====================================================
        //
        // Le prix demandé est déjà inférieur à la fourchette
        // basse de valorisation.
        //
        // → aucune négociation nécessaire
        // → on conserve le prix affiché
        //
        // Exemple :
        // asking = 285 000
        // low    = 346 199
        // high   = 509 116
        //
        // recommended = 285 000
        // negotiation = 0
        //
        // =====================================================

        if (askingPrice < estimatedValueLow) {
            recommendedPrice = askingPrice;
        }

        // =====================================================
        // 2. PRIX DANS LA FOURCHETTE DE MARCHÉ
        // =====================================================
        else if (askingPrice <= estimatedValueHigh) {
            const deviation = ((askingPrice - marketValue) / marketValue) * 100;

            // -----------------------------------------------
            // Prix cohérent avec le marché
            // -----------------------------------------------

            if (deviation <= 5) {
                recommendedPrice = askingPrice;
            }

            // -----------------------------------------------
            // Prix légèrement au-dessus du marché
            // -----------------------------------------------
            else {
                recommendedPrice = Math.round(marketValue);
            }
        }

        // =====================================================
        // 3. BIEN SURCOTÉ
        // =====================================================
        else {
            recommendedPrice = Math.round(marketValue);
        }

        // =====================================================
        // SÉCURITÉ
        // =====================================================
        //
        // Une recommandation ne doit jamais être supérieure
        // au prix demandé.
        //
        // C'est particulièrement important pour une opportunité
        // sous-évaluée.
        //
        // =====================================================

        if (recommendedPrice > askingPrice) {
            recommendedPrice = askingPrice;
        }

        // =====================================================
        // NÉGOCIATION
        // =====================================================

        const negotiationAmount = Math.max(0, askingPrice - recommendedPrice);

        let negotiationPotential = askingPrice > 0 ? (negotiationAmount / askingPrice) * 100 : 0;

        // =====================================================
        // PETITE NÉGOCIATION
        // =====================================================
        //
        // En dessous de 3 %, on considère qu'il n'y a pas
        // de potentiel de négociation significatif.
        //
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
