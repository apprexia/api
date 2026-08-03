import { Injectable } from '@nestjs/common';
import { CommuneIndicator } from '@prisma/client';
import { CommuneAnalysis } from '../../interfaces/commune-analysis.interface';

@Injectable()
export class CommuneEngineService {
    compute(commune: CommuneIndicator | null): CommuneAnalysis | null {
        if (!commune) {
            return null;
        }

        const dvfTransactions = commune.dvfTransactions ?? 0;
        const population = commune.population ?? 0;
        const evolutionPopulation = commune.evolutionPopulation5Years ?? 0;
        const priceEvolution = commune.priceEvolution5Years ?? 0;

        const fiberCoverage = commune.fiberCoverage ?? 0;
        const schoolIndex = commune.schoolIndex ?? 0;
        const doctorAccess = commune.doctorAccess ?? 0;

        const floodRisk = commune.floodRisk ?? 5;
        const icpeSurface = commune.icpeSurface ?? 100;
        const sevesoSurface = commune.sevesoSurface ?? 100;

        const propertyTaxRate = commune.propertyTaxRate ?? 100;

        let realEstate = 0;
        let demographics = 0;
        let qualityOfLife = 0;
        let environment = 0;
        let taxation = 0;

        const strengths: string[] = [];
        const weaknesses: string[] = [];

        // -----------------------------
        // IMMOBILIER (35)
        // -----------------------------

        if (priceEvolution != null) {
            if (priceEvolution >= 15) {
                realEstate += 20;
                strengths.push(`Marché immobilier dynamique (+${priceEvolution.toFixed(1)}% sur 5 ans)`);
            } else if (priceEvolution >= 5) {
                realEstate += 14;
            } else if (priceEvolution >= 0) {
                realEstate += 8;
            } else {
                weaknesses.push('Marché immobilier en recul');
            }
        }

        if (dvfTransactions >= 500) {
            realEstate += 15;
            strengths.push('Marché immobilier liquide');
        } else if (dvfTransactions >= 200) {
            realEstate += 10;
        } else if (dvfTransactions >= 50) {
            realEstate += 6;
        } else {
            weaknesses.push('Peu de transactions immobilières');
        }

        realEstate = Math.min(realEstate, 35);

        // -----------------------------
        // DEMOGRAPHIE (20)
        // -----------------------------

        if (population >= 50000) {
            demographics += 10;
            strengths.push('Commune attractive');
        } else if (population >= 10000) {
            demographics += 7;
        } else {
            demographics += 4;
        }

        if (evolutionPopulation >= 5) {
            demographics += 10;
            strengths.push('Population en croissance');
        } else if (evolutionPopulation >= 0) {
            demographics += 7;
        } else {
            weaknesses.push('Population en baisse');
        }

        demographics = Math.min(demographics, 20);

        // -----------------------------
        // QUALITE DE VIE (20)
        // -----------------------------

        if (fiberCoverage >= 90) {
            qualityOfLife += 7;
            strengths.push('Excellente couverture fibre');
        } else if (fiberCoverage >= 70) {
            qualityOfLife += 5;
        }

        if (schoolIndex >= 100) {
            qualityOfLife += 7;
            strengths.push('Bonne offre scolaire');
        } else if (schoolIndex >= 80) {
            qualityOfLife += 5;
        }

        if (doctorAccess >= 3.5) {
            qualityOfLife += 6;
            strengths.push('Bonne offre médicale');
        } else if (doctorAccess >= 2.5) {
            qualityOfLife += 4;
        } else {
            weaknesses.push('Accès aux soins limité');
        }

        qualityOfLife = Math.min(qualityOfLife, 20);

        // -----------------------------
        // ENVIRONNEMENT (15)
        // -----------------------------

        if (floodRisk <= 1) {
            environment += 6;
        } else if (floodRisk <= 2) {
            environment += 4;
        } else {
            weaknesses.push("Risque d'inondation; élevé;");
        }

        if ((icpeSurface ?? 0) < 10) {
            environment += 5;
        } else {
            weaknesses.push("Présence d'activités;industrielles;");
        }

        if ((sevesoSurface ?? 0) === 0) {
            environment += 4;
        } else {
            weaknesses.push('Présence de sites Seveso');
        }

        environment = Math.min(environment, 15);

        // -----------------------------
        // FISCALITE (10)
        // -----------------------------

        if (propertyTaxRate < 30) {
            taxation = 10;
            strengths.push('Fiscalité avantageuse');
        } else if (propertyTaxRate < 40) {
            taxation = 7;
        } else {
            taxation = 3;
            weaknesses.push('Taxe foncière élevée');
        }

        // -----------------------------

        const score = realEstate + demographics + qualityOfLife + environment + taxation;

        let level: CommuneAnalysis['level'];

        if (score >= 80) {
            level = 'Excellent';
        } else if (score >= 65) {
            level = 'Bon';
        } else if (score >= 45) {
            level = 'Moyen';
        } else {
            level = 'Faible';
        }

        return {
            score,

            level,

            strengths,

            weaknesses,

            breakdown: {
                realEstate,
                demographics,
                accessibility: qualityOfLife,
                environment,
                taxation,
            },
        };
    }
}
