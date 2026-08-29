import { Injectable, Logger } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { AnalysisAiResult } from '../../analyses/interfaces/analysis-ai-result.interface';
import { DvfMarketData } from '../../analyses/interfaces/dvf-market-data.interface';
import { ApprexiaMarketData } from '../../analyses/interfaces/apprexia-market-data.interface';
import { LocationAnalysis } from '../../apprexia-engine/interfaces/location-analysis.interface';
import { CommuneIndicator } from '@prisma/client';
import { ListingMetadata } from '../../meta-data-scrapper/interfaces/listing-metadata.interface';

@Injectable()
export class AnalysesAiService {
    private readonly logger = new Logger(AnalysesAiService.name);

    constructor(private readonly openaiService: OpenaiService) {}

    async analyze(
        metadata: ListingMetadata,
        marketData?: DvfMarketData | null,
        apprexiaMarketData?: ApprexiaMarketData | null,
        locationAnalysis?: LocationAnalysis | null,
        communeIndicator?: CommuneIndicator | null,
    ): Promise<AnalysisAiResult> {
        const start = Date.now();

        try {
            // =====================================================
            // 1. APPEL OPENAI
            // =====================================================

            const result = await this.openaiService.analyze(
                metadata,
                marketData,
                apprexiaMarketData,
                locationAnalysis,
                communeIndicator,
            );

            this.logger.log(`🤖 Réponse OpenAI reçue en ${Date.now() - start} ms`);

            // =====================================================
            // 2. NETTOYAGE JSON
            // =====================================================

            const cleaned = this.cleanJsonResponse(result);

            // =====================================================
            // 3. PARSING
            // =====================================================

            const parsed = JSON.parse(cleaned) as Partial<AnalysisAiResult>;

            this.logger.debug('🤖 Résultat IA parsé avec succès');

            // =====================================================
            // 4. NORMALISATION
            // =====================================================

            return this.normalizeAiResult(parsed, metadata, marketData);
        } catch (error) {
            this.logger.error(
                '❌ Impossible de générer ou parser l’analyse IA',
                error instanceof Error ? error.stack : String(error),
            );

            throw error;
        }
    }

    async explain(
        metadata: ListingMetadata,
        engineResult: AnalysisAiResult,
        marketData?: DvfMarketData | null,
        apprexiaMarketData?: ApprexiaMarketData | null,
        locationAnalysis?: LocationAnalysis | null,
        communeIndicator?: CommuneIndicator | null,
    ): Promise<AnalysisAiResult> {
        const start = Date.now();

        try {
            // =====================================================
            // 1. APPEL OPENAI
            // =====================================================

            const result = await this.openaiService.explain(
                metadata,
                engineResult,
                marketData,
                apprexiaMarketData,
                locationAnalysis,
                communeIndicator,
            );

            this.logger.log(`🤖 Explication OpenAI reçue en ${Date.now() - start} ms`);

            // =====================================================
            // 2. NETTOYAGE JSON
            // =====================================================

            const cleaned = this.cleanJsonResponse(result);

            // =====================================================
            // 3. PARSING
            // =====================================================

            const parsed = JSON.parse(cleaned) as Partial<AnalysisAiResult>;

            this.logger.debug('🤖 Explication IA parsée avec succès');

            // =====================================================
            // 4. RETOUR
            // =====================================================
            //
            // On conserve intégralement le résultat du moteur.
            //
            // L'IA ne peut remplacer que les éléments
            // rédactionnels.
            //
            // =====================================================

            return {
                ...engineResult,

                scoreExplanation: parsed.scoreExplanation ?? engineResult.scoreExplanation,

                verdictExplanation: parsed.verdictExplanation ?? engineResult.verdictExplanation,

                negotiationAnalysis: parsed.negotiationAnalysis ?? engineResult.negotiationAnalysis,

                yieldAnalysis: parsed.yieldAnalysis ?? engineResult.yieldAnalysis,

                strengths: Array.isArray(parsed.strengths) ? parsed.strengths : engineResult.strengths,

                risks: Array.isArray(parsed.risks) ? parsed.risks : engineResult.risks,
            };
        } catch (error) {
            this.logger.error(
                '❌ Impossible de générer ou parser les explications IA',
                error instanceof Error ? error.stack : String(error),
            );

            throw error;
        }
    }

    // =====================================================
    // NETTOYAGE JSON OPENAI
    // =====================================================

    private cleanJsonResponse(response: string): string {
        return response
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();
    }

    // =====================================================
    // NORMALISATION DU RÉSULTAT IA
    // =====================================================
    //
    // OpenAI :
    // - analyse le bien
    // - extrait / interprète les informations qualitatives
    // - fournit éventuellement des éléments d'analyse
    //
    // ApprexiaEngine :
    // - valorisation finale
    // - ajustement DVF
    // - prix conseillé
    // - négociation
    // - score
    // - verdict
    // - rentabilité
    //
    // =====================================================

    private normalizeAiResult(
        result: Partial<AnalysisAiResult>,
        metadata: ListingMetadata,
        marketData?: DvfMarketData | null,
    ): AnalysisAiResult {
        return {
            // =================================================
            // BIEN
            // =================================================

            title: result.title ?? metadata.title ?? 'Bien immobilier',

            city: result.city ?? metadata.city ?? '',

            rooms: result.rooms ?? metadata.rooms ?? 0,

            surface: result.surface ?? metadata.surface ?? 0,

            description: result.description ?? metadata.description ?? '',

            imageUrl: result.imageUrl ?? metadata.images?.[0] ?? 'images/placeholder.png',

            // =================================================
            // VALORISATION DVF
            // =================================================
            //
            // Ces valeurs sont uniquement des données d'entrée.
            // ApprexiaEngine les reprendra ensuite pour calculer
            // la valorisation définitive.
            //
            // =================================================

            estimatedValueLow: marketData?.lowEstimate ?? result.estimatedValueLow ?? 0,

            estimatedValueHigh: marketData?.highEstimate ?? result.estimatedValueHigh ?? 0,

            dvfReferenceValue: marketData?.dvfReferenceValue ?? result.dvfReferenceValue ?? 0,

            askingPrice: metadata.price ?? result.askingPrice ?? 0,

            // =================================================
            // DONNÉES QUALITATIVES
            // =================================================

            strengths: Array.isArray(result.strengths) ? result.strengths : [],

            risks: Array.isArray(result.risks) ? result.risks : [],

            // =================================================
            // VALEURS CALCULÉES PAR APPREXIA ENGINE
            // =================================================
            //
            // GPT ne doit plus être utilisé comme source pour
            // ces valeurs.
            //
            // ApprexiaEngine les remplacera ensuite.
            //
            // =================================================

            score: 0,

            scoreExplanation: '',

            verdict: 'ERREUR',

            verdictExplanation: '',

            marketPosition: 'PRIX MARCHE',

            recommendedPrice: 0,

            negotiationAmount: 0,

            negotiationPotential: 0,

            negotiationAnalysis: '',

            riskLevel: 0,

            // =================================================
            // RENTABILITÉ
            // =================================================
            //
            // Entièrement calculée par RentalEngine.
            //
            // =================================================

            estimatedRentMonthly: null,

            estimatedRentLow: null,

            estimatedRentHigh: null,

            rentPerSquareMeter: null,

            rentConfidence: null,

            grossYield: null,

            yieldLevel: 'INCONNU',

            yieldAnalysis: '',
        };
    }
}
