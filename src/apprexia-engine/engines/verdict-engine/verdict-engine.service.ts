import { Injectable } from '@nestjs/common';
import { EngineContext } from '../../interfaces/engine-context.interface';

export type Verdict = 'INVESTIR' | 'PRIX MARCHE' | 'NEGOCIER' | 'EVITER';

@Injectable()
export class VerdictEngineService {
  compute(context: EngineContext, score: number): Verdict {
    const analysis = context.analysis;

    const asking = analysis.askingPrice;
    const reference = analysis.dvfReferenceValue;
    const risk = analysis.riskLevel;
    const yieldRate = analysis.grossYield;

    if (!reference) {
      return 'PRIX MARCHE';
    }

    const delta = ((reference - asking) / reference) * 100;

    // Risque critique
    if (risk >= 85) {
      return 'EVITER';
    }

    // Forte décote
    if (
      delta >= 8 &&
      risk <= 50 &&
      score >= 65 &&
      (yieldRate == null || yieldRate >= 3)
    ) {
      return 'INVESTIR';
    }

    // Prix très supérieur au marché
    if (delta <= -20) {
      return 'EVITER';
    }

    // Prix cohérent
    if (delta >= -5 && delta <= 5) {
      return 'PRIX MARCHE';
    }

    // Surcote raisonnable
    if (delta < -5) {
      return 'NEGOCIER';
    }

    return 'PRIX MARCHE';
  }
}
