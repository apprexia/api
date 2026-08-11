export type EnergyClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export type EnergyLevel = 'EXCELLENT' | 'BON' | 'MOYEN' | 'FAIBLE' | 'TRES_FAIBLE';

export interface EnergyScoreInput {
    dpe?: string | null;
    ges?: string | null;
}

export interface EnergyScoreResult {
    score: number;
    level: EnergyLevel;
    dpe: EnergyClass | null;
    ges: EnergyClass | null;
    explanation: string;
    impacts: string[];
}
