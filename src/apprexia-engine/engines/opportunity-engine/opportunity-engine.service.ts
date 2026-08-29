import { Injectable } from '@nestjs/common';

@Injectable()
export class OpportunityEngineService {
    compute(
        askingPrice: number,
        estimatedValueLow: number,
        estimatedValueHigh: number,
        dvfReferenceValue?: number | null,
        confidence?: number | null,
        adjustedValue?: number | null,
    ): number {
        // =====================================================
        // VALEUR DE RÉFÉRENCE
        // =====================================================
        //
        // Priorité :
        //
        // 1. Valeur Apprexia ajustée
        // 2. DVF
        // 3. Milieu de la fourchette
        //
        // L'objectif est que l'opportunité utilise la même
        // réalité financière que les autres moteurs.
        //
        // =====================================================

        const referenceValue =
            adjustedValue && adjustedValue > 0
                ? adjustedValue
                : dvfReferenceValue && dvfReferenceValue > 0
                  ? dvfReferenceValue
                  : estimatedValueLow > 0 && estimatedValueHigh > 0
                    ? (estimatedValueLow + estimatedValueHigh) / 2
                    : 0;

        // =====================================================
        // DONNÉES INSUFFISANTES
        // =====================================================

        if (!referenceValue || referenceValue <= 0 || !askingPrice || askingPrice <= 0) {
            return 0;
        }

        // =====================================================
        // ÉCART PRIX / VALEUR APPREXIA
        // =====================================================
        //
        // Exemple :
        //
        // Valeur Apprexia : 300 000 €
        // Prix demandé    : 270 000 €
        //
        // delta = +10 %
        //
        // Plus le bien est sous sa valeur, plus l'opportunité
        // est importante.
        //
        // =====================================================

        const delta = ((referenceValue - askingPrice) / referenceValue) * 100;

        let opportunity = 0;

        // =====================================================
        // POSITION PRIX
        // =====================================================

        if (delta >= 25) {
            opportunity = 40;
        } else if (delta >= 15) {
            opportunity = 35;
        } else if (delta >= 5) {
            opportunity = 30;
        } else if (delta >= -5) {
            opportunity = 25;
        } else if (delta >= -15) {
            opportunity = 18;
        } else if (delta >= -25) {
            opportunity = 10;
        } else {
            opportunity = 5;
        }

        // =====================================================
        // FIABILITÉ DES DONNÉES
        // =====================================================
        //
        // Le bonus de confiance ne doit jamais permettre de
        // dépasser les 40 points maximum.
        //
        // =====================================================

        if (confidence !== null && confidence !== undefined) {
            if (confidence >= 80) {
                opportunity += 3;
            } else if (confidence >= 60) {
                opportunity += 2;
            }
        }

        return Math.min(Math.round(opportunity), 40);
    }
}
