import { Injectable } from '@nestjs/common';
import { EnergyClass, EnergyLevel, EnergyScoreInput, EnergyScoreResult } from './types/energy-score.types';

@Injectable()
export class EnergyEngineService {
    compute(input: EnergyScoreInput): EnergyScoreResult {
        const dpe = this.normalizeClass(input.dpe);
        const ges = this.normalizeClass(input.ges);

        const dpeScore = this.getClassScore(dpe);
        const gesScore = this.getClassScore(ges);

        let score = 0;
        let weight = 0;

        if (dpeScore !== null) {
            score += dpeScore * 0.7;
            weight += 0.7;
        }

        if (gesScore !== null) {
            score += gesScore * 0.3;
            weight += 0.3;
        }

        if (weight === 0) {
            return {
                score: 0,
                level: 'MOYEN',
                dpe,
                ges,
                explanation: 'Données énergétiques insuffisantes pour établir un score fiable.',
                impacts: [],
            };
        }

        score = Math.round(score / weight);

        return {
            score,
            level: this.getLevel(score),
            dpe,
            ges,
            explanation: this.getExplanation(score, dpe, ges),
            impacts: this.getImpacts(score, dpe, ges),
        };
    }

    private normalizeClass(value?: string | null): EnergyClass | null {
        if (!value) {
            return null;
        }

        const normalized = value.trim().toUpperCase();

        if (!['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(normalized)) {
            return null;
        }

        return normalized as EnergyClass;
    }

    private getClassScore(energyClass: EnergyClass | null): number | null {
        if (!energyClass) {
            return null;
        }

        const scores: Record<EnergyClass, number> = {
            A: 100,
            B: 85,
            C: 70,
            D: 55,
            E: 40,
            F: 20,
            G: 5,
        };

        return scores[energyClass];
    }

    private getLevel(score: number): EnergyLevel {
        if (score >= 85) {
            return 'EXCELLENT';
        }

        if (score >= 70) {
            return 'BON';
        }

        if (score >= 50) {
            return 'MOYEN';
        }

        if (score >= 30) {
            return 'FAIBLE';
        }

        return 'TRES_FAIBLE';
    }

    private getExplanation(score: number, dpe: EnergyClass | null, ges: EnergyClass | null): string {
        if (!dpe && !ges) {
            return 'Données énergétiques insuffisantes pour établir un score fiable.';
        }

        if (score >= 85) {
            return 'Très bonne performance énergétique du logement.';
        }

        if (score >= 70) {
            return 'Bonne performance énergétique avec un niveau de consommation globalement maîtrisé.';
        }

        if (score >= 50) {
            return 'Performance énergétique moyenne pouvant nécessiter une attention particulière.';
        }

        if (score >= 30) {
            return 'Performance énergétique faible pouvant entraîner des coûts et des travaux supplémentaires.';
        }

        return 'Performance énergétique très faible. Des travaux de rénovation énergétique importants peuvent être à prévoir.';
    }

    private getImpacts(score: number, dpe: EnergyClass | null, ges: EnergyClass | null): string[] {
        const impacts: string[] = [];

        if (dpe === 'F' || dpe === 'G') {
            impacts.push('Risque de travaux de rénovation énergétique important');
        }

        if (dpe === 'E') {
            impacts.push('Potentiel de travaux énergétiques à anticiper');
        }

        if (ges === 'F' || ges === 'G') {
            impacts.push('Niveau d’émissions de GES élevé');
        }

        if (score < 50) {
            impacts.push('La performance énergétique peut renforcer le potentiel de négociation');
        }

        if (score >= 70) {
            impacts.push('Bonne performance énergétique pouvant renforcer l’attractivité du bien');
        }

        return impacts;
    }
}
