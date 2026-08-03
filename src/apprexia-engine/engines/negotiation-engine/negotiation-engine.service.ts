import { Injectable } from '@nestjs/common';

export interface NegotiationResult {
    potential: number; // 0-100
    recommendedPrice: number;
    negotiationAmount: number;
    negotiationPercent: number;

    difficulty: 'Facile' | 'Possible' | 'Difficile' | 'Très difficile';

    reasons: string[];
}

@Injectable()
export class NegotiationEngineService {
    compute(
        askingPrice: number,
        marketValue: number,
        marketHigh: number,
        liquidityScore?: number,
        amenityScore?: number,
    ): NegotiationResult {
        const reasons: string[] = [];

        const gap = ((askingPrice - marketValue) / marketValue) * 100;

        const negotiationAmount = Math.max(0, askingPrice - marketValue);

        const negotiationPercent = (negotiationAmount / askingPrice) * 100;

        let potential = 0;

        // ==========================
        // ECART AU MARCHE
        // ==========================

        if (gap >= 40) {
            potential += 40;
            reasons.push('Prix fortement supérieur au marché');
        } else if (gap >= 25) {
            potential += 30;
            reasons.push('Marge de négociation importante');
        } else if (gap >= 15) {
            potential += 20;
        } else if (gap >= 5) {
            potential += 10;
        }

        // ==========================
        // POSITION PAR RAPPORT AU MAX DVF
        // ==========================

        if (askingPrice > marketHigh) {
            potential += 20;

            reasons.push('Prix au-dessus de la fourchette haute');
        }

        // ==========================
        // LIQUIDITE
        // ==========================

        if (liquidityScore != null) {
            // marché liquide = vendeur moins flexible
            if (liquidityScore >= 80) {
                potential -= 10;
            }
        }

        // ==========================
        // BIEN PREMIUM
        // ==========================

        if (amenityScore != null) {
            if (amenityScore >= 80) {
                potential -= 10;

                reasons.push('Prestations pouvant justifier le prix');
            }
        }

        potential = Math.max(0, Math.min(100, potential));

        let difficulty: 'Facile' | 'Possible' | 'Difficile' | 'Très difficile';

        if (potential >= 70) {
            difficulty = 'Facile';
        } else if (potential >= 45) {
            difficulty = 'Possible';
        } else if (potential >= 20) {
            difficulty = 'Difficile';
        } else {
            difficulty = 'Très difficile';
        }

        return {
            potential,

            recommendedPrice: Math.round(marketValue),

            negotiationAmount: Math.round(negotiationAmount),

            negotiationPercent: Math.round(negotiationPercent),

            difficulty,

            reasons,
        };
    }
}
