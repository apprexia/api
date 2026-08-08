import { Injectable } from '@nestjs/common';
import { EngineContext } from '../../interfaces/engine-context.interface';

export type Verdict = 'INVESTIR' | 'FAVORABLE' | 'NEGOCIER' | 'EVITER';

@Injectable()
export class VerdictEngineService {
    compute(context: EngineContext, score: number): Verdict {
        const analysis = context.analysis;

        const asking = analysis.askingPrice;
        const reference = analysis.dvfReferenceValue;

        const risk = analysis.riskLevel ?? 50;
        const yieldRate = analysis.grossYield;

        if (!reference) {
            return 'FAVORABLE';
        }

        const delta = ((reference - asking) / reference) * 100;

        // ==============================
        // RISQUE IMPORTANT
        // ==============================

        if (risk >= 80) {
            return 'EVITER';
        }

        // ==============================
        // OPPORTUNITE FORTE
        // ==============================

        if (delta >= 15 && score >= 70 && risk <= 40 && (yieldRate == null || yieldRate >= 4)) {
            return 'INVESTIR';
        }

        // ==============================
        // BONNE OPPORTUNITE
        // ==============================

        if (delta >= 8 && score >= 65 && risk <= 50) {
            return 'INVESTIR';
        }

        // ==============================
        // FORTE SURCOTE
        // ==============================

        if (delta <= -20) {
            return 'EVITER';
        }

        // ==============================
        // SURCOTE
        // ==============================

        if (delta <= -5) {
            return 'NEGOCIER';
        }

        // ==============================
        // PRIX COHERENT
        // ==============================

        return 'FAVORABLE';
    }
}
