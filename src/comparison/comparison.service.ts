import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { CreateComparisonDto } from './dto/create-comparison.dto';
import { UpdateComparisonDto } from './dto/update-comparison.dto';

import { PrismaService } from '../services/prisma/prisma.service';

import { ComparisonEngineData, ComparisonEngineService, ComparisonObjective } from './comparison-engine.service';

@Injectable()
export class ComparisonService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly comparisonEngine: ComparisonEngineService,
    ) {}

    // ==========================================================
    // CRÉER UNE COMPARAISON
    // ==========================================================

    async create(userId: string, dto: CreateComparisonDto) {
        /**
         * Vérification des analyses.
         */

        const analyses = await this.prisma.analysis.findMany({
            where: {
                id: {
                    in: dto.analysisIds,
                },

                userId,
            },

            select: {
                id: true,
            },
        });

        if (analyses.length !== dto.analysisIds.length) {
            throw new BadRequestException('Une ou plusieurs analyses sont introuvables ou ne vous appartiennent pas.');
        }

        /**
         * Évite les doublons dans une comparaison.
         */

        const uniqueAnalysisIds = new Set(dto.analysisIds);

        if (uniqueAnalysisIds.size !== dto.analysisIds.length) {
            throw new BadRequestException(
                'Une analyse ne peut pas être ajoutée plusieurs fois à une même comparaison.',
            );
        }

        /**
         * Création.
         */

        return this.prisma.comparison.create({
            data: {
                userId,

                name: dto.name.trim(),

                objective: dto.objective,

                analyses: {
                    create: dto.analysisIds.map((analysisId, index) => ({
                        analysisId,

                        position: index + 1,
                    })),
                },
            },

            include: {
                analyses: {
                    orderBy: {
                        position: 'asc',
                    },

                    include: {
                        analysis: true,
                    },
                },
            },
        });
    }

    // ==========================================================
    // LISTE DES COMPARAISONS
    // ==========================================================

    async findAll(userId: string) {
        const comparisons = await this.prisma.comparison.findMany({
            where: {
                userId,
            },

            orderBy: {
                updatedAt: 'desc',
            },

            include: {
                analyses: {
                    orderBy: {
                        position: 'asc',
                    },

                    include: {
                        analysis: {
                            select: {
                                id: true,
                                title: true,
                                city: true,
                                imageUrl: true,
                                score: true,
                                verdict: true,
                                askingPrice: true,
                                recommendedPrice: true,
                                grossYield: true,
                                negotiationPotential: true,
                                engine: true,
                            },
                        },
                    },
                },
            },
        });

        return comparisons.map((comparison) => {
            // ------------------------------------------------------
            // Préparation des données pour le moteur
            // ------------------------------------------------------

            const engineAnalyses = comparison.analyses.map((item) => {
                const engine = item.analysis.engine as ComparisonEngineData | null;

                return {
                    id: item.analysis.id,

                    score: item.analysis.score,

                    askingPrice: item.analysis.askingPrice,

                    recommendedPrice: item.analysis.recommendedPrice,

                    grossYield: item.analysis.grossYield,

                    negotiationPotential: item.analysis.negotiationPotential,

                    analysisConfidence: engine?.confidence ?? null,

                    engine,
                };
            });

            // ------------------------------------------------------
            // Calcul du comparateur
            // ------------------------------------------------------

            const comparisonResult = this.comparisonEngine.compare(
                engineAnalyses,
                comparison.objective as ComparisonObjective,
            );

            // ------------------------------------------------------
            // Index des analyses
            // ------------------------------------------------------

            const analysisMap = new Map(comparison.analyses.map((item) => [item.analysis.id, item.analysis]));

            // ------------------------------------------------------
            // Ranking enrichi
            // ------------------------------------------------------

            const enrichedRanking = comparisonResult.ranking.map((result) => ({
                ...result,

                analysis: analysisMap.get(result.analysisId) ?? null,
            }));

            // ------------------------------------------------------
            // Winner enrichi
            // ------------------------------------------------------

            const enrichedWinner = comparisonResult.winner
                ? {
                      ...comparisonResult.winner,

                      analysis: analysisMap.get(comparisonResult.winner.analysisId) ?? null,
                  }
                : null;

            // ------------------------------------------------------
            // Retour
            // ------------------------------------------------------

            return {
                ...comparison,

                result: {
                    ...comparisonResult,

                    ranking: enrichedRanking,

                    winner: enrichedWinner,
                },
            };
        });
    }

    // ==========================================================
    // DETAIL D'UNE COMPARAISON
    // ==========================================================

    async findOne(id: string, userId: string) {
        /**
         * ------------------------------------------------------
         * Récupération de la comparaison
         * ------------------------------------------------------
         */

        const comparison = await this.prisma.comparison.findFirst({
            where: {
                id,

                userId,
            },

            include: {
                analyses: {
                    orderBy: {
                        position: 'asc',
                    },

                    include: {
                        analysis: true,
                    },
                },
            },
        });

        if (!comparison) {
            throw new NotFoundException('Comparaison introuvable.');
        }

        /**
         * ------------------------------------------------------
         * Calcul + enrichissement
         * ------------------------------------------------------
         */

        return this.enrichComparison(comparison);
    }

    // ==========================================================
    // ENRICHIR UNE COMPARAISON
    // ==========================================================

    private enrichComparison(comparison: any) {
        /**
         * ------------------------------------------------------
         * Préparation des données pour le moteur
         * ------------------------------------------------------
         */

        const engineAnalyses = comparison.analyses.map((item: any) => {
            const engine = item.analysis.engine as ComparisonEngineData | null;

            return {
                id: item.analysis.id,

                score: item.analysis.score,

                askingPrice: item.analysis.askingPrice,

                recommendedPrice: item.analysis.recommendedPrice,

                grossYield: item.analysis.grossYield,

                negotiationPotential: item.analysis.negotiationPotential,

                analysisConfidence: engine?.confidence ?? null,

                engine,
            };
        });

        /**
         * ------------------------------------------------------
         * Calcul du comparateur
         * ------------------------------------------------------
         */

        const comparisonResult = this.comparisonEngine.compare(
            engineAnalyses,

            comparison.objective as ComparisonObjective,
        );

        /**
         * ------------------------------------------------------
         * Index des analyses
         * ------------------------------------------------------
         */

        const analysisMap = new Map(comparison.analyses.map((item: any) => [item.analysis.id, item.analysis]));

        /**
         * ------------------------------------------------------
         * Ranking enrichi
         * ------------------------------------------------------
         *
         * On conserve le ranking du moteur et on ajoute
         * les informations du bien correspondant.
         */

        const enrichedRanking = comparisonResult.ranking.map((result) => ({
            ...result,

            analysis: analysisMap.get(result.analysisId) ?? null,
        }));

        /**
         * ------------------------------------------------------
         * Winner enrichi
         * ------------------------------------------------------
         */

        const enrichedWinner = comparisonResult.winner
            ? {
                  ...comparisonResult.winner,

                  analysis: analysisMap.get(comparisonResult.winner.analysisId) ?? null,
              }
            : null;

        /**
         * ------------------------------------------------------
         * Résultat final
         * ------------------------------------------------------
         */

        return {
            ...comparison,

            result: {
                ...comparisonResult,

                ranking: enrichedRanking,

                winner: enrichedWinner,
            },
        };
    }

    // ==========================================================
    // MODIFIER UNE COMPARAISON
    // ==========================================================

    async update(id: string, userId: string, dto: UpdateComparisonDto) {
        /**
         * Vérifie que la comparaison appartient
         * bien à l'utilisateur.
         */

        await this.findOne(id, userId);

        return this.prisma.comparison.update({
            where: {
                id,
            },

            data: {
                ...(dto.name !== undefined && {
                    name: dto.name.trim(),
                }),

                ...(dto.objective !== undefined && {
                    objective: dto.objective,
                }),
            },
        });
    }

    // ==========================================================
    // SUPPRIMER UNE COMPARAISON
    // ==========================================================

    async remove(id: string, userId: string) {
        /**
         * Vérifie l'existence et les droits.
         */

        await this.findOne(id, userId);

        /**
         * Suppression.
         */

        await this.prisma.comparison.delete({
            where: {
                id,
            },
        });

        return {
            success: true,

            message: 'Comparaison supprimée avec succès.',
        };
    }
}
