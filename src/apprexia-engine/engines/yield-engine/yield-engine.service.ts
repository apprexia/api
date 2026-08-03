import { Injectable } from '@nestjs/common';

@Injectable()
export class YieldEngineService {
    compute(grossYield: number | null | undefined, city?: string): number {
        if (grossYield == null) {
            return 8;
        }

        const marketProfile = this.getMarketProfile(city);

        switch (marketProfile) {
            case 'PREMIUM':
                return this.computePremiumYield(grossYield);

            case 'TENSE':
                return this.computeTenseYield(grossYield);

            default:
                return this.computeStandardYield(grossYield);
        }
    }

    private getMarketProfile(city?: string) {
        const normalized = city?.toUpperCase() ?? '';

        const premiumCities = ['PARIS', 'LYON', 'BORDEAUX', 'NANTES', 'RENNES', 'ANNECY'];

        const tenseCities = ['TOULOUSE', 'MONTPELLIER', 'LILLE', 'STRASBOURG', 'GRENOBLE', 'NICE'];

        if (premiumCities.some((c) => normalized.includes(c))) {
            return 'PREMIUM';
        }

        if (tenseCities.some((c) => normalized.includes(c))) {
            return 'TENSE';
        }

        return 'STANDARD';
    }

    // Marchés patrimoniaux
    private computePremiumYield(yieldValue: number) {
        if (yieldValue >= 6) return 15;
        if (yieldValue >= 5) return 13;
        if (yieldValue >= 4) return 11;
        if (yieldValue >= 3) return 8;

        return 5;
    }

    // Grandes villes tendues
    private computeTenseYield(yieldValue: number) {
        if (yieldValue >= 7) return 15;
        if (yieldValue >= 5.5) return 13;
        if (yieldValue >= 4) return 10;
        if (yieldValue >= 3) return 7;

        return 4;
    }

    // Villes classiques
    private computeStandardYield(yieldValue: number) {
        if (yieldValue >= 9) return 15;
        if (yieldValue >= 7) return 13;
        if (yieldValue >= 5) return 11;
        if (yieldValue >= 3) return 8;

        return 4;
    }
}
