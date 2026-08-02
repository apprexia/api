import { Injectable } from '@nestjs/common';
import { EngineContext } from '../../interfaces/engine-context.interface';
import { ScoreResult } from '../../interfaces/score-result.interface';
import { YieldEngineService } from '../yield-engine/yield-engine.service';
import { ConfidenceEngineService } from '../confidence-engine/confidence-engine.service';
import { OpportunityEngineService } from '../opportunity-engine/opportunity-engine.service';
import { AmenityEngineService } from '../amenity-engine/amenity-engine.service';
import { LiquidityEngineService } from '../liquidity-engine/liquidity-engine.service';

@Injectable()
export class ScoreEngineService {
  constructor(
    private readonly yieldEngine: YieldEngineService,
    private readonly confidenceEngine: ConfidenceEngineService,
    private readonly opportunityEngine: OpportunityEngineService,
    private readonly amenityEngine: AmenityEngineService,
    private readonly liquidityEngine: LiquidityEngineService,
  ) {}

  compute(context: EngineContext): ScoreResult {
    const analysis = context.analysis;

    // ======================================================
    // 1. OPPORTUNITÉ PRIX (40 pts)
    // ======================================================

    const opportunityScore = this.opportunityEngine.compute(
      analysis.askingPrice,
      analysis.estimatedValueLow,
      analysis.estimatedValueHigh,
      analysis.dvfReferenceValue,
    );

    // ======================================================
    // 2. RISQUE (20 pts)
    // ======================================================

    const riskScore = Math.round(Math.max(0, (100 - analysis.riskLevel) / 5));

    // ======================================================
    // 3. RENDEMENT LOCATIF (15 pts)
    // ======================================================

    const yieldScore = this.yieldEngine.compute(
      analysis.grossYield,
      analysis.city,
    );

    // ======================================================
    // 4. PRESTATIONS (10 pts)
    // ======================================================

    const amenitiesScore = this.amenityEngine.compute(
      analysis.propertyFeatures,
      analysis.surface,
    );

    // ======================================================
    // 5. CONFIANCE DATA (10 pts)
    // ======================================================

    const confidenceScore = this.confidenceEngine.compute(
      context.dvf,
      context.apprexia,
    );

    // ======================================================
    // 6. LIQUIDITÉ (5 pts)
    // ======================================================

    const liquidityScore = this.liquidityEngine.compute(
      context.dvf?.count ?? 0,
      analysis.city,
      analysis.surface,
    );

    // ======================================================
    // SCORE FINAL
    // ======================================================

    const score = Math.min(
      100,
      Math.round(
        opportunityScore +
          riskScore +
          yieldScore +
          amenitiesScore.score +
          confidenceScore +
          liquidityScore,
      ),
    );

    return {
      score,
      opportunityScore,
      riskScore,
      yieldScore,
      amenitiesScore,
      confidenceScore,
      liquidityScore,
    };
  }
}
