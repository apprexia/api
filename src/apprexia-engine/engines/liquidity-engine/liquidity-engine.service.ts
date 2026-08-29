import { Injectable } from '@nestjs/common';

@Injectable()
export class LiquidityEngineService {
    compute(
        salesCount: number,
        city?: string,
        surface?: number,
        population?: number,
        populationGrowth?: number,
    ): number {
        let score = 0;

        // =====================================================
        // 1. VOLUME DU MARCHÉ — 8 POINTS
        // =====================================================

        if (salesCount >= 2000) {
            score += 8;
        } else if (salesCount >= 1000) {
            score += 7;
        } else if (salesCount >= 500) {
            score += 6;
        } else if (salesCount >= 200) {
            score += 5;
        } else if (salesCount >= 50) {
            score += 3;
        } else if (salesCount > 0) {
            score += 1;
        }

        // =====================================================
        // 2. TAILLE DU BASSIN DE POPULATION — 5 POINTS
        // =====================================================

        if (population != null && population > 0) {
            if (population >= 500000) {
                score += 5;
            } else if (population >= 200000) {
                score += 4;
            } else if (population >= 50000) {
                score += 2;
            } else if (population >= 20000) {
                score += 1;
            }
        }

        // =====================================================
        // 3. DYNAMISME DÉMOGRAPHIQUE — 4 POINTS
        // =====================================================

        if (populationGrowth != null) {
            if (populationGrowth >= 5) {
                score += 4;
            } else if (populationGrowth >= 2) {
                score += 3;
            } else if (populationGrowth > 0) {
                score += 2;
            } else if (populationGrowth >= -2) {
                score += 1;
            }
        }

        // =====================================================
        // 4. TYPOLOGIE DU BIEN — 3 POINTS
        // =====================================================
        //
        // Les petites et moyennes surfaces sont généralement
        // plus faciles à revendre ou relouer.
        //
        // =====================================================

        if (surface != null && surface > 0) {
            if (surface >= 20 && surface <= 70) {
                score += 3;
            } else if (surface > 70 && surface <= 100) {
                score += 2;
            } else if (surface > 100 && surface <= 150) {
                score += 1;
            }
        }

        // =====================================================
        // VILLE
        // =====================================================
        //
        // Le paramètre city est conservé dans la signature pour
        // permettre d'enrichir ultérieurement le moteur avec
        // des profils de marché spécifiques.
        //
        // Il ne génère volontairement aucun point directement :
        // la population et les transactions sont des indicateurs
        // plus objectifs.
        //
        // =====================================================

        void city;

        // =====================================================
        // SCORE FINAL
        // =====================================================

        return Math.min(score, 20);
    }
}
