import { AmenityResult } from './amenity-result.interface';

export interface ScoreResult {
    score: number;
    opportunityScore: number;
    riskScore: number;
    yieldScore: number;
    energyScore: number;
    amenitiesScore: AmenityResult;
    confidenceScore: number;
    liquidityScore: number;
}
