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
    const referenceValue =
      dvfReferenceValue ?? (estimatedValueLow + estimatedValueHigh) / 2;

    if (!referenceValue || !askingPrice) {
      return 0;
    }

    const delta = ((referenceValue - askingPrice) / referenceValue) * 100;

    let opportunity = 0;

    // =====================================
    // OPPORTUNITE PRIX VS MARCHE
    // =====================================

    if (delta >= 25) {
      opportunity = 40;
    } else if (delta >= 15) {
      opportunity = 35;
    } else if (delta >= 10) {
      opportunity = 30;
    } else if (delta >= 5) {
      opportunity = 25;
    } else if (delta >= 2) {
      opportunity = 20;
    } else if (delta >= -2) {
      opportunity = 15;
    } else if (delta >= -5) {
      opportunity = 10;
    } else if (delta >= -10) {
      opportunity = 5;
    } else {
      opportunity = 0;
    }

    // =====================================
    // FIABILITE DVF
    // =====================================

    if (confidence !== null && confidence !== undefined) {
      if (confidence >= 80) {
        opportunity += 2;
      } else if (confidence >= 60) {
        opportunity += 1;
      }
    }

    // Prix anormalement bas = prudence
    if (askingPrice < referenceValue * 0.7) {
      opportunity = Math.min(opportunity, 25);
    }

    return Math.min(Math.round(opportunity), 40);
  }
}
