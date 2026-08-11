import { Injectable } from '@nestjs/common';
import { EngineContext } from '../../interfaces/engine-context.interface';
import { ScoreResult } from '../../interfaces/score-result.interface';
import { YieldEngineService } from '../yield-engine/yield-engine.service';
import { ConfidenceEngineService } from '../confidence-engine/confidence-engine.service';
import { OpportunityEngineService } from '../opportunity-engine/opportunity-engine.service';
import { AmenityEngineService } from '../amenity-engine/amenity-engine.service';
import { LiquidityEngineService } from '../liquidity-engine/liquidity-engine.service';
import { EnergyEngineService } from '../energy-engine/energy-engine.service';

@Injectable()
export class ScoreEngineService {
    constructor(
        private readonly yieldEngine: YieldEngineService,
        private readonly confidenceEngine: ConfidenceEngineService,
        private readonly opportunityEngine: OpportunityEngineService,
        private readonly amenityEngine: AmenityEngineService,
        private readonly liquidityEngine: LiquidityEngineService,
        private readonly energyEngine: EnergyEngineService,
    ) {}

    compute(context: EngineContext): ScoreResult {
        const analysis = context.analysis;

        // ======================================================
        // 1. OPPORTUNITÉ PRIX (35 pts)
        // ======================================================

        const opportunityRaw = this.opportunityEngine.compute(
            analysis.askingPrice,
            analysis.estimatedValueLow,
            analysis.estimatedValueHigh,
            analysis.dvfReferenceValue,
        );

        const opportunityScore = Math.round((opportunityRaw / 40) * 35);

        // ======================================================
        // 2. RISQUE (20 pts)
        // ======================================================

        const riskScore = Math.round(Math.max(0, (100 - analysis.riskLevel) / 5));

        // ======================================================
        // 3. RENDEMENT LOCATIF (15 pts)
        // ======================================================

        const yieldScore = this.yieldEngine.compute(analysis.grossYield, analysis.city);

        // ======================================================
        // 4. PERFORMANCE ÉNERGÉTIQUE (10 pts)
        // ======================================================

        const energyResult = this.energyEngine.compute({
            dpe: analysis.dpe,
            ges: analysis.ges,
        });

        const energyScore = Math.round((energyResult.score / 100) * 10);

        // ======================================================
        // 5. PRESTATIONS (10 pts)
        // ======================================================

        const amenitiesResult = this.amenityEngine.compute(analysis.propertyFeatures, analysis.surface);

        const amenitiesScore = Math.round((amenitiesResult.score / 100) * 10);

        // ======================================================
        // 6. CONFIANCE DATA (5 pts)
        // ======================================================

        const confidenceRaw = this.confidenceEngine.compute(context.dvf, context.apprexia);
        const confidenceScore = Math.round((confidenceRaw / 10) * 5);

        // ======================================================
        // 7. LIQUIDITÉ (5 pts)
        // ======================================================

        const liquidityRaw = this.liquidityEngine.compute(context.dvf?.count ?? 0, analysis.city, analysis.surface);

        const liquidityScore = Math.round((liquidityRaw / 20) * 5);

        // ======================================================
        // SCORE FINAL /100
        // ======================================================

        const score = Math.min(
            100,
            Math.round(
                opportunityScore +
                    riskScore +
                    yieldScore +
                    energyScore +
                    amenitiesScore +
                    confidenceScore +
                    liquidityScore,
            ),
        );

        return {
            score,

            opportunityScore,

            riskScore,

            yieldScore,

            energyScore,

            amenitiesScore: {
                ...amenitiesResult,
                score: amenitiesResult.score,
            },

            confidenceScore,

            liquidityScore,
        };
    }
}
