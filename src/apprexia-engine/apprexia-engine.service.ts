import { Injectable } from '@nestjs/common';

import { EngineContext } from './interfaces/engine-context.interface';

import { MarketPositionEngineService } from './engines/market-position-engine/market-position-engine.service';
import { RecommendedPriceEngineService } from './engines/recommended-price-engine/recommended-price-engine.service';
import { ScoreEngineService } from './engines/score-engine/score-engine.service';
import { VerdictEngineService } from './engines/verdict-engine/verdict-engine.service';
import { RentalEngineService } from './engines/rental-engine/rental-engine.service';
import { PropertyValueAdjustmentEngineService } from './engines/property-value-adjustment/property-value-adjustment.service';
import { CommuneEngineService } from './engines/commune-engine/commune-engine.service';
import { EnergyEngineService } from './engines/energy-engine/energy-engine.service';
import { AcquisitionCostEngineService } from './engines/acquisition-cost-engine/acquisition-cost-engine.service';
import { AnalysisAiResult } from '../analyses/interfaces/analysis-ai-result.interface';

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
        private readonly energyEngine: EnergyEngineService,
        private readonly acquisitionCostEngine: AcquisitionCostEngineService,
    ) {}

    async evaluate(context: EngineContext): Promise<AnalysisAiResult> {
        console.log('🏗️ APPREXIA ENGINE PROPERTY CONDITION:', context.metadata.propertyCondition);

        // =====================================================
        // 0. COPIE DE BASE
        // =====================================================

        const analysis: AnalysisAiResult = {
            ...context.analysis,
        };

        // =====================================================
        // 1. VALORISATION DU BIEN
        // =====================================================
        //
        // DVF = base objective.
        //
        // GPT peut fournir une estimation initiale mais ne
        // décide pas de la valeur finale.
        //
        // Apprexia applique ensuite ses propres ajustements.
        //
        // =====================================================

        const baseValue = context.dvf?.dvfReferenceValue ?? context.analysis.dvfReferenceValue ?? 0;

        let adjustedValue = baseValue;

        let valuationRange = {
            valueLow: context.dvf?.lowEstimate ?? context.analysis.estimatedValueLow ?? 0,

            valueHigh: context.dvf?.highEstimate ?? context.analysis.estimatedValueHigh ?? 0,
        };

        let adjustmentCoefficient = 1;

        // =====================================================
        // 1.1 AJUSTEMENT SELON LES CARACTÉRISTIQUES DU BIEN
        // =====================================================

        if (baseValue > 0) {
            console.log('🏗️ VALUE ADJUSTMENT INPUT:', {
                propertyCondition: context.metadata.propertyCondition,
                features: context.metadata.propertyFeatures,
                terrain: context.metadata.terrain,
                surface: context.metadata.surface,
                typeLocal: context.metadata.typeLocal,
            });

            adjustmentCoefficient = this.propertyValueAdjustmentEngine.compute({
                features: context.metadata.propertyFeatures,
                terrain: context.metadata.terrain,
                surface: context.metadata.surface,
                typeLocal: context.metadata.typeLocal,
                propertyCondition: context.metadata.propertyCondition,
            });

            adjustedValue = this.propertyValueAdjustmentEngine.adjustValue(baseValue, adjustmentCoefficient);

            console.log('🏗️ VALUE ADJUSTMENT:', {
                baseValue,
                adjustmentCoefficient,
                adjustedValue,
            });

            // =================================================
            // 1.2 FOURCHETTE DVF AJUSTÉE
            // =================================================

            const originalLow = context.dvf?.lowEstimate ?? context.analysis.estimatedValueLow ?? 0;

            const originalHigh = context.dvf?.highEstimate ?? context.analysis.estimatedValueHigh ?? 0;

            if (originalLow > 0 && originalHigh > 0 && baseValue > 0) {
                const lowRatio = originalLow / baseValue;
                const highRatio = originalHigh / baseValue;

                valuationRange = {
                    valueLow: Math.round(adjustedValue * Math.max(lowRatio, 0.85)),

                    valueHigh: Math.round(adjustedValue * Math.min(highRatio, 1.25)),
                };
            } else {
                // =================================================
                // FALLBACK
                // =================================================

                valuationRange = {
                    valueLow: Math.round(adjustedValue * 0.9),

                    valueHigh: Math.round(adjustedValue * 1.1),
                };
            }
        }

        // =====================================================
        // 1.3 SÉCURISATION DE LA FOURCHETTE
        // =====================================================

        if (
            valuationRange.valueLow > 0 &&
            valuationRange.valueHigh > 0 &&
            valuationRange.valueLow > valuationRange.valueHigh
        ) {
            const temporary = valuationRange.valueLow;

            valuationRange.valueLow = valuationRange.valueHigh;

            valuationRange.valueHigh = temporary;
        }

        console.log('🏗️ VALUATION RESULT:', {
            baseValue,
            adjustmentCoefficient,
            adjustedValue,
            valueLow: valuationRange.valueLow,
            valueHigh: valuationRange.valueHigh,
        });

        // =====================================================
        // 2. CONTEXTE FINANCIER UNIFIÉ
        // =====================================================
        //
        // Tous les moteurs utilisent exactement les mêmes
        // valeurs de référence.
        //
        // =====================================================

        const engineContext: EngineContext = {
            ...context,

            analysis: {
                ...context.analysis,

                estimatedValueLow: valuationRange.valueLow,

                estimatedValueHigh: valuationRange.valueHigh,

                dvfReferenceValue: baseValue,

                valuation: {
                    baseValue,

                    adjustedValue,

                    valueLow: valuationRange.valueLow,

                    valueHigh: valuationRange.valueHigh,

                    factors: [],
                },
            },
        };

        // =====================================================
        // 3. POSITIONNEMENT MARCHÉ
        // =====================================================

        const marketPosition = this.marketPositionEngine.compute(engineContext);

        console.log('🏷️ MARKET POSITION:', marketPosition);

        // =====================================================
        // 4. PRIX CONSEILLÉ + NÉGOCIATION
        // =====================================================

        const recommendation = this.recommendedPriceEngine.compute({
            ...engineContext,

            analysis: {
                ...engineContext.analysis,

                marketPosition,
            },
        });

        console.log('💰 PRICE RECOMMENDATION:', recommendation);

        // =====================================================
        // 4.1 FRAIS D'ACQUISITION
        // =====================================================

        const acquisitionCosts = this.acquisitionCostEngine.compute({
            price: recommendation.recommendedPrice,
            propertyCondition: context.metadata.propertyCondition,
        });

        console.log('🏠 ACQUISITION COSTS:', acquisitionCosts);

        // =====================================================
        // 5. RENTABILITÉ LOCATIVE
        // =====================================================

        const rental = await this.rentalEngine.compute(engineContext);

        console.log('🏠 RENTAL ENGINE RESULT:', rental);

        // =====================================================
        // 6. CONTEXTE COMMUNE
        // =====================================================

        const communeAnalysis = this.communeEngine.compute(engineContext.commune);

        // =====================================================
        // 7. PERFORMANCE ÉNERGÉTIQUE
        // =====================================================

        const energy = this.energyEngine.compute({
            dpe: context.metadata.dpe,
            ges: context.metadata.ges,
        });

        console.log('⚡ ENERGY SCORE RESULT:', energy);

        // =====================================================
        // 8. CONTEXTE FINAL POUR LE SCORE
        // =====================================================

        const scoringContext: EngineContext = {
            ...engineContext,

            analysis: {
                ...engineContext.analysis,

                marketPosition,

                recommendedPrice: recommendation.recommendedPrice,

                negotiationAmount: recommendation.negotiationAmount,

                negotiationPotential: recommendation.negotiationPotential,

                estimatedRentMonthly: rental?.estimatedRentMonthly ?? null,

                estimatedRentLow: rental?.estimatedRentLow ?? null,

                estimatedRentHigh: rental?.estimatedRentHigh ?? null,

                rentPerSquareMeter: rental?.rentPerSquareMeter ?? null,

                rentConfidence: rental?.rentConfidence ?? null,

                grossYield: rental?.grossYield ?? null,

                yieldLevel: rental?.yieldLevel ?? null,

                yieldAnalysis: rental?.yieldAnalysis ?? null,

                energy,
            },
        };

        // =====================================================
        // 9. SCORE GLOBAL
        // =====================================================

        const scoreResult = this.scoreEngine.compute(scoringContext);

        console.log('📊 SCORE RESULT:', scoreResult);

        // =====================================================
        // 10. CONTEXTE FINAL POUR LE VERDICT
        // =====================================================
        //
        // IMPORTANT :
        //
        // Le RiskEngine est exécuté à l'intérieur du
        // ScoreEngine.
        //
        // Le ScoreEngine retourne :
        //
        // - riskScore  → poids du risque dans le score global
        // - riskLevel  → niveau de risque réel de 0 à 100
        //
        // Le VerdictEngine doit utiliser riskLevel.
        //
        // =====================================================

        const riskLevel = scoreResult.riskLevel;

        const verdictContext: EngineContext = {
            ...scoringContext,

            analysis: {
                ...scoringContext.analysis,

                riskLevel,
            },
        };

        console.log('🚦 VERDICT ENGINE INPUT:', {
            score: scoreResult.score,

            riskScore: scoreResult.riskScore,

            riskLevel,

            asking: verdictContext.analysis.askingPrice,

            reference: verdictContext.analysis.valuation?.adjustedValue ?? verdictContext.analysis.dvfReferenceValue,

            yieldRate: verdictContext.analysis.grossYield,
        });

        // =====================================================
        // 11. VERDICT
        // =====================================================
        //
        // Le verdict est 100 % calculé par Apprexia Engine.
        //
        // GPT ne peut pas le remplacer.
        //
        // IMPORTANT :
        // Le troisième argument est le riskLevel calculé
        // par le RiskEngine via le ScoreEngine.
        //
        // =====================================================

        const verdict = this.verdictEngine.compute(verdictContext, scoreResult.score, riskLevel);

        console.log('🚦 VERDICT:', verdict);

        // =====================================================
        // 12. CONFIANCE GLOBALE
        // =====================================================

        const confidence = this.computeConfidence(verdictContext);

        // =====================================================
        // 13. ANALYSE FINALE
        // =====================================================

        const finalAnalysis: AnalysisAiResult = {
            ...analysis,

            // -------------------------------------------------
            // VALORISATION
            // -------------------------------------------------

            estimatedValueLow: valuationRange.valueLow,

            estimatedValueHigh: valuationRange.valueHigh,

            dvfReferenceValue: baseValue,

            valuation: {
                baseValue,

                adjustedValue,

                valueLow: valuationRange.valueLow,

                valueHigh: valuationRange.valueHigh,

                factors: [],
            },

            // -------------------------------------------------
            // MARCHÉ
            // -------------------------------------------------

            marketPosition,

            // -------------------------------------------------
            // PRIX
            // -------------------------------------------------

            recommendedPrice: recommendation.recommendedPrice,

            negotiationAmount: recommendation.negotiationAmount,

            negotiationPotential: recommendation.negotiationPotential,

            // -------------------------------------------------
            // FRAIS D'ACQUISITION
            // -------------------------------------------------

            estimatedNotaryFees: acquisitionCosts.notaryFees,

            notaryFeeRate: acquisitionCosts.notaryFeeRate,

            // -------------------------------------------------
            // RENTABILITÉ
            // -------------------------------------------------

            estimatedRentMonthly: rental?.estimatedRentMonthly ?? null,

            estimatedRentLow: rental?.estimatedRentLow ?? null,

            estimatedRentHigh: rental?.estimatedRentHigh ?? null,

            rentPerSquareMeter: rental?.rentPerSquareMeter ?? null,

            rentConfidence: rental?.rentConfidence ?? null,

            grossYield: rental?.grossYield ?? null,

            yieldLevel: rental?.yieldLevel ?? null,

            yieldAnalysis: rental?.yieldAnalysis ?? null,

            // -------------------------------------------------
            // RISQUE
            // -------------------------------------------------

            riskLevel,

            // -------------------------------------------------
            // ÉNERGIE
            // -------------------------------------------------

            energy,

            // -------------------------------------------------
            // COMMUNE
            // -------------------------------------------------

            communeAnalysis,

            // -------------------------------------------------
            // SCORE
            // -------------------------------------------------

            score: scoreResult.score,

            // -------------------------------------------------
            // VERDICT
            // -------------------------------------------------

            verdict,

            // -------------------------------------------------
            // ENGINE
            // -------------------------------------------------

            engine: {
                confidence,

                score: scoreResult.score,

                verdict,

                marketPosition,

                breakdown: {
                    opportunity: scoreResult.opportunityScore,

                    risk: scoreResult.riskScore,

                    yield: scoreResult.yieldScore,

                    energy: scoreResult.energyScore,

                    amenities: scoreResult.amenitiesScore.score,

                    confidence: scoreResult.confidenceScore,

                    liquidity: scoreResult.liquidityScore,
                },
            },
        };

        // =====================================================
        // 14. LOG FINAL
        // =====================================================

        console.log('🏁 APPREXIA ENGINE FINAL RESULT:', {
            askingPrice: finalAnalysis.askingPrice,

            dvfReferenceValue: finalAnalysis.dvfReferenceValue,

            estimatedValueLow: finalAnalysis.estimatedValueLow,

            estimatedValueHigh: finalAnalysis.estimatedValueHigh,

            recommendedPrice: finalAnalysis.recommendedPrice,

            negotiationAmount: finalAnalysis.negotiationAmount,

            negotiationPotential: finalAnalysis.negotiationPotential,

            marketPosition: finalAnalysis.marketPosition,

            score: finalAnalysis.score,

            riskLevel: finalAnalysis.riskLevel,

            verdict: finalAnalysis.verdict,
        });

        return finalAnalysis;
    }

    // =========================================================
    // CONFIANCE GLOBALE
    // =========================================================

    private computeConfidence(context: EngineContext): number {
        let confidence = 50;

        // -----------------------------------------------------
        // DVF
        // -----------------------------------------------------

        if (context.dvf) {
            confidence += context.dvf.confidence * 0.25;
        }

        // -----------------------------------------------------
        // COMPARABLES APPREXIA
        // -----------------------------------------------------

        if (context.apprexia) {
            confidence += context.apprexia.confidence * 0.2;

            if (context.apprexia.count >= 10) {
                confidence += 5;
            }

            if (context.apprexia.strongComparablesCount >= 5) {
                confidence += 5;
            }
        }

        // -----------------------------------------------------
        // ADRESSE
        // -----------------------------------------------------

        if (context.metadata.address) {
            confidence += 5;
        }

        // -----------------------------------------------------
        // PHOTOS
        // -----------------------------------------------------

        if ((context.metadata.images?.length ?? 0) >= 5) {
            confidence += 5;
        }

        return Math.min(100, Math.round(confidence));
    }
}
