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

        // ==============================
        // Volume marché (8 points)
        // ==============================

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
        } else {
            score += 1;
        }

        // ==============================
        // Taille ville (5 points)
        // ==============================

        if (population) {
            if (population >= 500000) {
                score += 5;
            } else if (population >= 200000) {
                score += 4;
            } else if (population >= 50000) {
                score += 2;
            }
        }

        // ==============================
        // Dynamisme démographique (4 points)
        // ==============================

        if (populationGrowth) {
            if (populationGrowth >= 5) {
                score += 4;
            } else if (populationGrowth >= 2) {
                score += 3;
            } else if (populationGrowth > 0) {
                score += 2;
            }
        }

        // ==============================
        // Typologie liquide (3 points)
        // ==============================

        if (surface != null) {
            // studios/T2/T3 = plus facile à revendre
            if (surface >= 20 && surface <= 70) {
                score += 3;
            }
        }

        return Math.min(score, 20);
    }
}
