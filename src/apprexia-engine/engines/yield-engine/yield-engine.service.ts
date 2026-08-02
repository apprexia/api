import { Injectable } from '@nestjs/common';

@Injectable()
export class YieldEngineService {
  compute(grossYield: number | null | undefined, city?: string): number {
    // Valeur neutre lorsqu'on ne dispose pas de données
    if (grossYield == null) {
      return 8;
    }

    const isHighDemandCity =
      city?.toUpperCase().includes('PARIS') ||
      city?.toUpperCase().includes('LYON') ||
      city?.toUpperCase().includes('BORDEAUX');

    if (isHighDemandCity) {
      return this.computeHighDemandYield(grossYield);
    }

    return this.computeStandardYield(grossYield);
  }

  private computeHighDemandYield(grossYield: number): number {
    if (grossYield >= 5) return 15;
    if (grossYield >= 4) return 12;
    if (grossYield >= 3) return 9;
    if (grossYield >= 2) return 6;

    return 3;
  }

  private computeStandardYield(grossYield: number): number {
    if (grossYield >= 9) return 15;
    if (grossYield >= 7) return 13;
    if (grossYield >= 5) return 10;
    if (grossYield >= 3) return 7;

    return 3;
  }
}
