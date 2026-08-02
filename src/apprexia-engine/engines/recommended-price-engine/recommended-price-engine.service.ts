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
    const {
      askingPrice,
      estimatedValueLow,
      estimatedValueHigh,
      dvfReferenceValue,
    } = context.analysis;

    if (!askingPrice || !estimatedValueLow || !estimatedValueHigh) {
      return {
        recommendedPrice: askingPrice ?? 0,
        negotiationAmount: 0,
        negotiationPotential: 0,
      };
    }

    const marketValue =
      dvfReferenceValue ?? (estimatedValueLow + estimatedValueHigh) / 2;

    let recommendedPrice = askingPrice;

    // ---------------------------------
    // Sous-évalué
    // ---------------------------------

    if (askingPrice < estimatedValueLow) {
      recommendedPrice = askingPrice;
    }

    // ---------------------------------
    // Prix marché
    // ---------------------------------
    else if (askingPrice <= estimatedValueHigh) {
      const deviation = ((askingPrice - marketValue) / marketValue) * 100;

      // Prix déjà cohérent avec le marché
      if (deviation <= 5) {
        recommendedPrice = askingPrice;
      }

      // Prix légèrement élevé mais négociable
      else {
        recommendedPrice = Math.round(marketValue);
      }
    }

    // ---------------------------------
    // Surcoté
    // ---------------------------------
    else {
      recommendedPrice = Math.round(marketValue);
    }

    let negotiationAmount = Math.max(0, askingPrice - recommendedPrice);

    const negotiationPotential =
      ((askingPrice - recommendedPrice) / askingPrice) * 100;

    if (negotiationPotential < 3) {
      negotiationAmount = 0;
    }

    return {
      recommendedPrice,
      negotiationAmount,
      negotiationPotential,
    };
  }
}
