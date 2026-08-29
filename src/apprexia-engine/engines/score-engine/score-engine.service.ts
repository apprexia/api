import { Injectable } from '@nestjs/common';

import { EngineContext } from '../../interfaces/engine-context.interface';
import { ScoreResult } from '../../interfaces/score-result.interface';

import { YieldEngineService } from '../yield-engine/yield-engine.service';
import { ConfidenceEngineService } from '../confidence-engine/confidence-engine.service';
import { OpportunityEngineService } from '../opportunity-engine/opportunity-engine.service';
import { AmenityEngineService } from '../amenity-engine/amenity-engine.service';
import { LiquidityEngineService } from '../liquidity-engine/liquidity-engine.service';
import { EnergyEngineService } from '../energy-engine/energy-engine.service';
import { RiskEngineService } from '../risk-engine/risk-engine.service';

@Injectable()
export class ScoreEngineService {
    constructor(
        private readonly yieldEngine: YieldEngineService,
        private readonly confidenceEngine: ConfidenceEngineService,
        private readonly opportunityEngine: OpportunityEngineService,
        private readonly amenityEngine: AmenityEngineService,
        private readonly liquidityEngine: LiquidityEngineService,
        private readonly energyEngine: EnergyEngineService,
        private readonly riskEngine: RiskEngineService,
    ) {}

    compute(context: EngineContext): ScoreResult {
        const analysis = context.analysis;

        // ======================================================
        // 1. OPPORTUNITÉ PRIX — 35 POINTS
        // ======================================================

        const opportunityRaw = this.opportunityEngine.compute(
            analysis.askingPrice,
            analysis.estimatedValueLow,
            analysis.estimatedValueHigh,
            analysis.dvfReferenceValue,
            context.dvf?.confidence ?? context.apprexia?.confidence ?? null,
            analysis.valuation?.adjustedValue ?? null,
        );

        const opportunityScore = Math.min(35, Math.round((opportunityRaw / 40) * 35));

        // ======================================================
        // 2. RISQUE — 20 POINTS
        // ======================================================

        /**
         * RiskEngine = source unique du niveau de risque.
         *
         * riskLevel :
         * 0   = aucun risque
         * 100 = risque maximal
         *
         * Conversion :
         * 0 risque   → 20 points
         * 100 risque → 0 point
         */
        const riskLevel = this.riskEngine.compute(context);

        const riskScore = Math.min(20, Math.round(Math.max(0, (100 - riskLevel) / 5)));

        // ======================================================
        // 3. RENDEMENT LOCATIF — 15 POINTS
        // ======================================================

        const yieldScore = Math.min(15, this.yieldEngine.compute(analysis.grossYield, analysis.city));

        // ======================================================
        // 4. PERFORMANCE ÉNERGÉTIQUE — 10 POINTS
        // ======================================================

        const energyResult = this.energyEngine.compute({
            dpe: context.metadata.dpe ?? analysis.dpe,
            ges: context.metadata.ges ?? analysis.ges,
        });

        const energyScore = Math.min(10, Math.round((energyResult.score / 100) * 10));

        // ======================================================
        // 5. PRESTATIONS — 10 POINTS
        // ======================================================

        /**
         * AmenityEngine retourne une note intrinsèque sur 100.
         *
         * Exemple :
         *
         * amenitiesResult.score = 44
         *
         * Conversion pour le score global :
         *
         * 44 / 100 × 10 = 4.4
         * → 4 points
         *
         * IMPORTANT :
         * propertyCondition provient des metadata et non
         * de AnalysisAiResult.
         */
        const amenitiesResult = this.amenityEngine.compute(
            context.metadata.propertyFeatures ?? null,
            context.metadata.surface ?? analysis.surface,
            context.metadata.propertyCondition ?? null,
        );

        const amenitiesScore = Math.min(10, Math.round((amenitiesResult.score / 100) * 10));

        // ======================================================
        // 6. CONFIANCE — 5 POINTS
        // ======================================================

        const confidenceRaw = this.confidenceEngine.compute(context.dvf, context.apprexia);

        const confidenceScore = Math.min(5, Math.round((confidenceRaw / 10) * 5));

        // ======================================================
        // 7. LIQUIDITÉ — 5 POINTS
        // ======================================================

        const liquidityRaw = this.liquidityEngine.compute(
            context.dvf?.count ?? context.commune?.dvfTransactions ?? 0,
            analysis.city,
            analysis.surface,
            context.commune?.population ?? undefined,
            context.commune?.evolutionPopulation5Years ?? undefined,
        );

        const liquidityScore = Math.min(5, Math.round((liquidityRaw / 20) * 5));

        // ======================================================
        // 8. SCORE FINAL
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

        // ======================================================
        // 9. LOG DEBUG
        // ======================================================

        console.log('📊 SCORE ENGINE');

        console.log({
            opportunity: {
                raw: opportunityRaw,
                score: opportunityScore,
                max: 35,
            },

            risk: {
                level: riskLevel,
                score: riskScore,
                max: 20,
            },

            yield: {
                score: yieldScore,
                max: 15,
            },

            energy: {
                raw: energyResult.score,
                score: energyScore,
                max: 10,
            },

            amenities: {
                raw: amenitiesResult.score,
                score: amenitiesScore,
                max: 10,
                level: amenitiesResult.level,
                highlights: amenitiesResult.highlights,
            },

            confidence: {
                raw: confidenceRaw,
                score: confidenceScore,
                max: 5,
            },

            liquidity: {
                raw: liquidityRaw,
                score: liquidityScore,
                max: 5,
            },

            total: score,
        });

        // ======================================================
        // 10. RETOUR
        // ======================================================

        return {
            score,

            opportunityScore,

            riskLevel,

            riskScore,

            yieldScore,

            energyScore,

            /**
             * On retourne l'AmenityResult original.
             *
             * IMPORTANT :
             * Ne pas ajouter "contribution" ici car
             * AmenityResult ne possède pas cette propriété.
             *
             * La contribution au score global est déjà disponible
             * dans le champ amenitiesScore calculé ci-dessus.
             */
            amenitiesScore: amenitiesResult,

            confidenceScore,

            liquidityScore,
        };
    }
}
