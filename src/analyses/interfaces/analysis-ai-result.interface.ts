import { PropertyFeatures } from '../../services/meta-data-scrapper/interfaces/property-features.interface';
import { MarketPosition } from '../../apprexia-engine/interfaces/market-position.interface';
import { CommuneAnalysis } from 'src/apprexia-engine/interfaces/commune-analysis.interface';

export type Verdict = 'INVESTIR' | 'FAVORABLE' | 'NEGOCIER' | 'EVITER' | 'ERREUR';

export interface ValuationFactor {
    name: string;
    impact: number;
    description?: string;
}

export interface PropertyValuation {
    baseValue: number;
    adjustedValue: number;

    valueLow: number;
    valueHigh: number;

    factors: ValuationFactor[];
}

export interface EngineBreakdown {
    opportunity: number;
    risk: number;
    yield: number;
    amenities: number;
    confidence: number;
    liquidity: number;
}

export interface EngineResult {
    confidence: number;
    score: number;
    verdict: Verdict;
    marketPosition: MarketPosition;
    breakdown: EngineBreakdown;
}

export interface AmenityResult {
    score: number;

    level: 'Premium' | 'Très bon' | 'Bon' | 'Correct' | 'Faible' | 'Non renseigné';

    highlights: {
        label: string;
        icon: string;
        points: number;
    }[];
}

export interface AnalysisAiResult {
    // ===============================
    // Bien
    // ===============================

    title: string;
    city: string;
    rooms: number;
    surface: number;

    description: string;
    imageUrl: string;

    propertyFeatures?: PropertyFeatures;

    // ===============================
    // Amenities
    // ===============================

    amenities?: AmenityResult;

    // ===============================
    // Commune
    // ===============================

    communeAnalysis?: CommuneAnalysis | null;

    // ===============================
    // Score Apprexia
    // ===============================

    score: number;
    scoreExplanation: string;

    // ===============================
    // Décision
    // ===============================

    verdict: Verdict;
    verdictExplanation: string;

    marketPosition: MarketPosition;

    // ===============================
    // Valorisation
    // ===============================

    estimatedValueLow: number;
    estimatedValueHigh: number;

    dvfReferenceValue: number;

    askingPrice: number;

    valuation?: PropertyValuation;

    // ===============================
    // Négociation
    // ===============================

    recommendedPrice: number;

    negotiationAmount: number;

    negotiationPotential: number;

    negotiationAnalysis: string;

    // ===============================
    // Rentabilité locative
    // ===============================

    grossYield?: number | null;

    yieldLevel: string | null;

    yieldAnalysis: string | null;

    estimatedRentMonthly: number | null;

    estimatedRentLow: number | null;

    estimatedRentHigh: number | null;

    rentPerSquareMeter: number | null;

    rentConfidence: number | null;

    // ===============================
    // Analyse risques
    // ===============================

    riskLevel: number;

    strengths: string[];

    risks: string[];

    // ===============================
    // Détails moteurs Apprexia
    // ===============================

    engine?: EngineResult;
}
