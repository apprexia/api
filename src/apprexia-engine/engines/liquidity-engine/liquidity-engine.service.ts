import { Injectable } from '@nestjs/common';

@Injectable()
export class LiquidityEngineService {
  compute(salesCount: number, city?: string, surface?: number): number {
    let score = 0;

    // Nombre de ventes comparables
    if (salesCount >= 100) {
      score = 5;
    } else if (salesCount >= 50) {
      score = 4;
    } else if (salesCount >= 20) {
      score = 3;
    } else if (salesCount >= 10) {
      score = 2;
    } else if (salesCount >= 5) {
      score = 1;
    }

    // Studio parisien = marché très liquide
    if (
      city?.toUpperCase().includes('PARIS') &&
      surface != null &&
      surface >= 18 &&
      surface <= 30
    ) {
      score += 2;
    }

    // Typologie familiale recherchée
    if (surface != null && surface >= 25 && surface <= 70) {
      score += 1;
    }

    return Math.min(5, score);
  }
}
