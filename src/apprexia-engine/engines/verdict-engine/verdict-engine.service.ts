import { Injectable } from '@nestjs/common';

import { EngineContext } from '../../interfaces/engine-context.interface';

export type Verdict = 'INVESTIR' | 'NEGOCIER' | 'EVITER';

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
                return 'NEGOCIER';
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
        //
        // Ici le prix devient secondaire.
        //
        // Si le risque est extrêmement élevé,
        // Apprexia recommande d'éviter.
        //
        // =====================================================

        if (riskLevel >= 80) {
            return 'EVITER';
        }

        // =====================================================
        // 2. SCORE TRÈS FAIBLE
        // =====================================================
        //
        // Un score < 40 signifie que le bien présente
        // globalement trop peu d'intérêt.
        //
        // =====================================================

        if (score < 40) {
            return 'EVITER';
        }

        // =====================================================
        // 3. EXCELLENTE OPPORTUNITÉ
        // =====================================================
        //
        // Prix inférieur à la valeur Apprexia,
        // bon score et faible risque.
        //
        // =====================================================

        if (delta <= -15 && score >= 70 && riskLevel <= 40 && (yieldRate == null || yieldRate >= 4)) {
            return 'INVESTIR';
        }

        // =====================================================
        // 4. BONNE OPPORTUNITÉ
        // =====================================================

        if (delta <= -8 && score >= 65 && riskLevel <= 50) {
            return 'INVESTIR';
        }

        // =====================================================
        // 5. PRIX TRÈS SUPÉRIEUR À LA VALEUR
        // =====================================================
        //
        // Une forte surcote ne signifie pas automatiquement
        // que le bien doit être évité.
        //
        // Si les fondamentaux restent corrects, Apprexia
        // recommande de négocier.
        //
        // EVITER uniquement si le score est réellement faible
        // ou si le niveau de risque est élevé.
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

        if (delta >= -5 && delta <= 5) {
            // Très bon bien au prix du marché
            if (score >= 70 && riskLevel <= 40 && (yieldRate == null || yieldRate >= 4)) {
                return 'INVESTIR';
            }

            // Bien intéressant mais pas suffisamment
            // exceptionnel pour INVESTIR immédiatement
            if (score >= 50 && riskLevel <= 60) {
                return 'NEGOCIER';
            }

            return 'EVITER';
        }

        // =====================================================
        // 8. SOUS-ÉVALUATION MODÉRÉE
        // =====================================================

        if (delta < -5) {
            if (score >= 55 && riskLevel <= 60) {
                return 'NEGOCIER';
            }

            return 'EVITER';
        }

        // =====================================================
        // FALLBACK
        // =====================================================

        return 'NEGOCIER';
    }
}
