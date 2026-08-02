import { AmenityScoreResult } from '../engines/amenity-engine/amenity-engine.service';

export interface ScoreResult {
  score: number;
  opportunityScore: number;
  riskScore: number;
  yieldScore: number;
  amenitiesScore: AmenityScoreResult;
  confidenceScore: number;
  liquidityScore: number;
}