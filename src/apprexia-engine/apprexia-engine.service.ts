import { Injectable } from '@nestjs/common';
import { EngineContext } from './interfaces/engine-context.interface';
import { MarketPositionEngineService } from './engines/market-position-engine/market-position-engine.service';
import { RecommendedPriceEngineService } from './engines/recommended-price-engine/recommended-price-engine.service';
import { ScoreEngineService } from './engines/score-engine/score-engine.service';
import { VerdictEngineService } from './engines/verdict-engine/verdict-engine.service';
import { RentalEngineService } from './engines/rental-engine/rental-engine.service';
import { AnalysisAiResult } from '../analyses/interfaces/analysis-ai-result.interface';
import { PropertyValueAdjustmentEngineService } from './engines/property-value-adjustment/property-value-adjustment.service';
import { CommuneEngineService } from './engines/commune-engine/commune-engine.service';

@Injectable()
export class ApprexiaEngineService {
    constructor(
        private readonly marketPositionEngine: MarketPositionEngineService,
        private readonly recommendedPriceEngine: RecommendedPriceEngineService,
        private readonly scoreEngine: ScoreEngineService,
        private readonly verdictEngine: VerdictEngineService,
        private readonly rentalEngine: RentalEngineService,
        private readonly propertyValueAdjustmentEngine: PropertyValueAdjustmentEngineService,
        private readonly communeEngine: CommuneEngineService,
    ) {}

    async evaluate(context: EngineContext): Promise<AnalysisAiResult> {
        const analysis = { ...context.analysis };

        // ===============================
        // 0. Ajustement valeur du bien
        // ===============================

        const adjustmentCoefficient = this.propertyValueAdjustmentEngine.compute({
            features: context.metadata.propertyFeatures,
            terrain: context.metadata.terrain,
            surface: context.metadata.surface,
            typeLocal: context.metadata.typeLocal,
        });

        const baseValue = context.analysis.dvfReferenceValue;

        const adjustedValue = this.propertyValueAdjustmentEngine.adjustValue(baseValue, adjustmentCoefficient);

        const dvfLow = context.analysis.estimatedValueLow;
        const dvfHigh = context.analysis.estimatedValueHigh;

        const lowRatio = dvfLow / baseValue;
        const highRatio = dvfHigh / baseValue;

        const valuationRange = {
            valueLow: Math.round(adjustedValue * Math.max(lowRatio, 0.85)),
            valueHigh: Math.round(adjustedValue * Math.min(highRatio, 1.25)),
        };

        const valuationContext = {
            ...context,
            analysis: {
                ...context.analysis,

                estimatedValueLow: valuationRange.valueLow,
                estimatedValueHigh: valuationRange.valueHigh,

                valuation: {
                    baseValue,
                    adjustedValue,

                    valueLow: valuationRange.valueLow,
                    valueHigh: valuationRange.valueHigh,

                    factors: [],
                },
            },
        };

        // ===============================
        // 1. Position marché
        // ===============================

        const marketPosition = this.marketPositionEngine.compute(valuationContext);

        // ===============================
        // 2. Prix conseillé
        // ===============================

        const recommendation = this.recommendedPriceEngine.compute(valuationContext);

        // ===============================
        // 2.1 Rentabilité locative
        // ===============================

        const rental = await this.rentalEngine.compute(context);
        console.log('🏠 RENTAL ENGINE RESULT', rental);

        // ===============================
        // 2.2 Commune
        // ===============================

        const communeAnalysis = this.communeEngine.compute(context.commune);

        // ===============================
        // 3. Score
        // ===============================

        const scoreResult = this.scoreEngine.compute({
            ...valuationContext,
            analysis: {
                ...valuationContext.analysis,
                marketPosition,
                recommendedPrice: recommendation.recommendedPrice,

                grossYield: rental?.grossYield ?? null,
                riskLevel: valuationContext.analysis.riskLevel ?? 0,
            },
        });

        // ===============================
        // 4. Verdict
        // ===============================

        const verdict = this.verdictEngine.compute(
            {
                ...valuationContext,
                analysis: {
                    ...valuationContext.analysis,

                    marketPosition,

                    score: scoreResult.score,

                    recommendedPrice: recommendation.recommendedPrice,

                    grossYield: rental?.grossYield ?? null,

                    riskLevel: valuationContext.analysis.riskLevel ?? 0,
                },
            },
            scoreResult.score,
        );

        // ===============================
        // 5. Confiance moteur
        // ===============================

        const confidence = this.computeConfidence(context);

        // ===============================
        // 6. Résultat final
        // ===============================

        return {
            ...analysis,

            score: scoreResult.score,
            verdict,
            marketPosition,

            recommendedPrice: recommendation.recommendedPrice,
            negotiationAmount: recommendation.negotiationAmount,
            negotiationPotential: recommendation.negotiationPotential,
            communeAnalysis,
            engine: {
                confidence,
                score: scoreResult.score,
                verdict,
                marketPosition,
                breakdown: {
                    opportunity: scoreResult.opportunityScore,
                    risk: scoreResult.riskScore,
                    yield: scoreResult.yieldScore,
                    amenities: scoreResult.amenitiesScore.score,
                    confidence: scoreResult.confidenceScore,
                    liquidity: scoreResult.liquidityScore,
                },
            },

            valuation: {
                baseValue,
                adjustedValue,
                valueLow: valuationRange.valueLow,
                valueHigh: valuationRange.valueHigh,
                factors: [],
            },

            estimatedValueLow: valuationRange.valueLow,
            estimatedValueHigh: valuationRange.valueHigh,

            estimatedRentMonthly: rental?.estimatedRentMonthly ?? null,
            estimatedRentLow: rental?.estimatedRentLow ?? null,
            estimatedRentHigh: rental?.estimatedRentHigh ?? null,
            rentPerSquareMeter: rental?.rentPerSquareMeter ?? null,
            rentConfidence: rental?.rentConfidence ?? null,
            grossYield: rental?.grossYield ?? null,
            yieldLevel: rental?.yieldLevel ?? null,
            yieldAnalysis: rental?.yieldAnalysis ?? null,
        };
    }

    private computeConfidence(context: EngineContext): number {
        let confidence = 50;

        // -------------------------
        // DVF
        // -------------------------

        if (context.dvf) {
            confidence += context.dvf.confidence * 0.25;
        }

        // -------------------------
        // Comparables Apprexia
        // -------------------------

        if (context.apprexia) {
            confidence += context.apprexia.confidence * 0.2;

            if (context.apprexia.count >= 10) {
                confidence += 5;
            }

            if (context.apprexia.strongComparablesCount >= 5) {
                confidence += 5;
            }
        }

        // -------------------------
        // Adresse connue
        // -------------------------

        if (context.metadata.address) {
            confidence += 5;
        }

        // -------------------------
        // Photos
        // -------------------------

        if ((context.metadata.images?.length ?? 0) >= 5) {
            confidence += 5;
        }

        return Math.min(100, Math.round(confidence));
    }
}
