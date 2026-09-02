import { Injectable } from '@nestjs/common';

import { EngineContext } from '../../interfaces/engine-context.interface';

export type Verdict = 'INVESTIR' | 'FAVORABLE' | 'NEGOCIER' | 'EVITER';

@Injectable()
export class VerdictEngineService {
    compute(context: EngineContext, score: number, riskLevel: number): Verdict {
        const analysis = context.analysis;

        const asking = analysis.askingPrice;

        const reference =
            analysis.valuation?.adjustedValue ??
            (analysis.estimatedValueLow && analysis.estimatedValueHigh
                ? (analysis.estimatedValueLow + analysis.estimatedValueHigh) / 2
                : analysis.dvfReferenceValue);

        const yieldRate = analysis.grossYield;

        // =====================================================
        // LOG
        // =====================================================

        console.log('🚦 VERDICT ENGINE INPUT:', {
            score,
            riskLevel,
            asking,
            reference,
            yieldRate,
        });

        // =====================================================
        // DONNÉES INSUFFISANTES
        // =====================================================

        if (!asking || asking <= 0 || !reference || reference <= 0) {
            if (score >= 70 && riskLevel <= 40) {
                return 'FAVORABLE';
            }

            return 'EVITER';
        }

        // =====================================================
        // ÉCART PRIX / VALEUR APPREXIA
        // =====================================================

        const delta = ((asking - reference) / reference) * 100;

        console.log('🚦 VERDICT DELTA:', delta);

        // =====================================================
        // 1. RISQUE CRITIQUE
        // =====================================================

        if (riskLevel >= 80) {
            return 'EVITER';
        }

        // =====================================================
        // 2. SCORE TRÈS FAIBLE
        // =====================================================

        if (score < 40) {
            return 'EVITER';
        }

        // =====================================================
        // 3. EXCELLENTE OPPORTUNITÉ
        // =====================================================
        //
        // Prix nettement inférieur à la valeur Apprexia,
        // excellent score, faible risque et rendement correct.
        //
        // =====================================================

        if (delta <= -15 && score >= 70 && riskLevel <= 40 && (yieldRate == null || yieldRate >= 4)) {
            return 'INVESTIR';
        }

        // =====================================================
        // 4. BONNE OPPORTUNITÉ
        // =====================================================
        //
        // Sous-évaluation importante avec bons fondamentaux.
        //
        // =====================================================

        if (delta <= -8 && score >= 65 && riskLevel <= 50) {
            return 'INVESTIR';
        }

        // =====================================================
        // 5. PRIX TRÈS SUPÉRIEUR À LA VALEUR
        // =====================================================

        if (delta > 20) {
            if (score < 45 || riskLevel >= 70) {
                return 'EVITER';
            }

            return 'NEGOCIER';
        }

        // =====================================================
        // 6. SURCOTE MODÉRÉE
        // =====================================================

        if (delta > 5) {
            if (score >= 50 && riskLevel <= 60) {
                return 'NEGOCIER';
            }

            return 'EVITER';
        }

        // =====================================================
        // 7. PRIX COHÉRENT
        // =====================================================
        //
        // Le prix est proche de la valeur Apprexia.
        //
        // Excellent bien :
        // → FAVORABLE
        //
        // Bien intéressant :
        // → FAVORABLE
        //
        // =====================================================

        if (delta >= -5 && delta <= 5) {
            // Très bon bien au prix du marché
            if (score >= 70 && riskLevel <= 40 && (yieldRate == null || yieldRate >= 4)) {
                return 'FAVORABLE';
            }

            // Bien intéressant et cohérent avec le marché
            if (score >= 50 && riskLevel <= 60) {
                return 'FAVORABLE';
            }

            return 'EVITER';
        }

        // =====================================================
        // 8. SOUS-ÉVALUATION MODÉRÉE
        // =====================================================
        //
        // Le prix est inférieur à la valeur estimée.
        //
        // Si les fondamentaux sont très bons :
        // → FAVORABLE
        //
        // Sinon, si le bien est correct :
        // → NEGOCIER
        //
        // =====================================================

        if (delta < -5) {
            if (score >= 65 && riskLevel <= 40) {
                return 'FAVORABLE';
            }

            if (score >= 55 && riskLevel <= 60) {
                return 'FAVORABLE';
            }

            return 'EVITER';
        }

        // =====================================================
        // FALLBACK
        // =====================================================

        return 'NEGOCIER';
    }
}
