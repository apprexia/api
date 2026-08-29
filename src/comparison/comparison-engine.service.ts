    import { Injectable } from '@nestjs/common';

    /**
     * ============================================================
     * OBJECTIFS DE COMPARAISON
     * ============================================================
     */

    export type ComparisonObjective =
        'GLOBAL' | 'PROFITABILITY' | 'SECURITY' | 'CAPITAL_GAIN' | 'NEGOTIATION' | 'LIQUIDITY';

    /**
     * ============================================================
     * BREAKDOWN DU MOTEUR APPREXIA
     * ============================================================
     *
     * Les valeurs correspondent aux points réellement attribués
     * par l'ApprexiaEngine.
     *
     * Exemple :
     *
     * opportunity: 35 / 35
     * yield:       11 / 15
     * energy:       6 / 10
     * amenities:    5 / 10
     * liquidity:    0 / 5
     * risk:        15 / 20
     * confidence:   4 / 5
     */

    export interface EngineBreakdown {
        opportunity?: number | null;
        risk?: number | null;
        yield?: number | null;
        energy?: number | null;
        amenities?: number | null;
        confidence?: number | null;
        liquidity?: number | null;
    }

    /**
     * ============================================================
     * DONNÉES DU MOTEUR
     * ============================================================
     */

    export interface ComparisonEngineData {
        score?: number | null;
        verdict?: string | null;
        confidence?: number | null;
        marketPosition?: string | null;
        breakdown?: EngineBreakdown | null;
    }

    /**
     * ============================================================
     * ENTRÉE D'UNE ANALYSE
     * ============================================================
     */

    export interface ComparisonAnalysisInput {
        id: string;

        score?: number | null;

        askingPrice?: number | null;
        recommendedPrice?: number | null;

        grossYield?: number | null;

        negotiationPotential?: number | null;

        analysisConfidence?: number | null;

        engine?: ComparisonEngineData | null;
    }

    /**
     * ============================================================
     * SCORES NORMALISÉS
     * ============================================================
     *
     * Toutes les catégories sont ramenées sur 100.
     */

    export interface ComparisonScores {
        opportunity: number;
        profitability: number;
        energy: number;
        amenities: number;
        liquidity: number;
        risk: number;
        confidence: number;
    }

    /**
     * ============================================================
     * RÉSULTAT D'UNE COMPARAISON
     * ============================================================
     */

    export interface ComparisonResult {
        analysisId: string;

        /**
         * Score global de comparaison sur 100.
         */
        comparisonScore: number;

        /**
         * Scores détaillés par catégorie sur 100.
         */
        scores: ComparisonScores;

        /**
         * Position dans le classement.
         */
        rank: number;

        /**
         * Verdict Apprexia.
         */
        verdict?: string | null;

        /**
         * Positionnement marché.
         */
        marketPosition?: string | null;

        /**
         * Niveau de confiance.
         */
        confidence?: number | null;
    }

    /**
     * ============================================================
     * SERVICE
     * ============================================================
     */

    @Injectable()
    export class ComparisonEngineService {
        /**
         * ========================================================
         * COMPARAISON PRINCIPALE
         * ========================================================
         */

        compare(analyses: ComparisonAnalysisInput[], objective: ComparisonObjective = 'GLOBAL') {
            /**
             * Aucun bien à comparer.
             */
            if (!analyses || analyses.length === 0) {
                return {
                    objective,
                    ranking: [],
                    winner: null,
                    categoryWinners: {},
                };
            }

            /**
             * ----------------------------------------------------
             * 1. CALCUL DES SCORES
             * ----------------------------------------------------
             */

            const results: ComparisonResult[] = analyses.map((analysis) => {
                const scores = this.extractScores(analysis);

                const comparisonScore = this.calculateScore(scores, objective);

                const engine = analysis.engine ?? {};

                return {
                    analysisId: analysis.id,

                    comparisonScore,

                    scores,

                    rank: 0,

                    verdict: engine.verdict ?? null,

                    marketPosition: engine.marketPosition ?? null,

                    confidence: engine.confidence ?? analysis.analysisConfidence ?? null,
                };
            });

            /**
             * ----------------------------------------------------
             * 2. CLASSEMENT
             * ----------------------------------------------------
             *
             * Le meilleur score est en première position.
             */

            results.sort((a, b) => b.comparisonScore - a.comparisonScore);

            results.forEach((result, index) => {
                result.rank = index + 1;
            });

            /**
             * ----------------------------------------------------
             * 3. GAGNANTS PAR CATÉGORIE
             * ----------------------------------------------------
             */

            const categoryWinners = this.getCategoryWinners(results);

            /**
             * ----------------------------------------------------
             * 4. GAGNANT GLOBAL
             * ----------------------------------------------------
             */

            const winner = results[0] ?? null;

            return {
                objective,

                ranking: results,

                winner,

                categoryWinners,
            };
        }

        /**
         * ========================================================
         * EXTRACTION DES SCORES
         * ========================================================
         *
         * Le moteur Apprexia travaille avec des points pondérés.
         *
         * Exemple :
         *
         * opportunity = 35 / 35
         * yield       = 11 / 15
         *
         * Le comparateur transforme ensuite ces valeurs en score
         * comparable sur 100.
         */

        private extractScores(analysis: ComparisonAnalysisInput): ComparisonScores {
            const breakdown = analysis.engine?.breakdown ?? {};

            return {
                /**
                 * 35 points maximum.
                 */
                opportunity: this.normalizeWeightedScore(breakdown.opportunity, 35),

                /**
                 * 15 points maximum.
                 */
                profitability: this.normalizeWeightedScore(breakdown.yield, 15),

                /**
                 * 10 points maximum.
                 */
                energy: this.normalizeWeightedScore(breakdown.energy, 10),

                /**
                 * 10 points maximum.
                 */
                amenities: this.normalizeWeightedScore(breakdown.amenities, 10),

                /**
                 * 5 points maximum.
                 */
                liquidity: this.normalizeWeightedScore(breakdown.liquidity, 5),

                /**
                 * 20 points maximum.
                 */
                risk: this.normalizeWeightedScore(breakdown.risk, 20),

                /**
                 * 5 points maximum.
                 */
                confidence: this.normalizeWeightedScore(breakdown.confidence, 5),
            };
        }

        /**
         * ========================================================
         * CALCUL DU SCORE COMPARATEUR
         * ========================================================
         *
         * Chaque catégorie est déjà normalisée sur 100.
         *
         * Les poids dépendent ensuite de l'objectif choisi.
         */

        private calculateScore(scores: ComparisonScores, objective: ComparisonObjective): number {
            const weights = this.getWeights(objective);

            const score =
                scores.opportunity * weights.opportunity +
                scores.profitability * weights.profitability +
                scores.energy * weights.energy +
                scores.amenities * weights.amenities +
                scores.liquidity * weights.liquidity +
                scores.risk * weights.risk +
                scores.confidence * weights.confidence;

            return Math.round(this.normalize(score));
        }

        /**
         * ========================================================
         * PONDÉRATIONS PAR OBJECTIF
         * ========================================================
         *
         * La somme de chaque configuration = 1.
         */

        private getWeights(objective: ComparisonObjective) {
            switch (objective) {
                /**
                 * =================================================
                 * GLOBAL
                 * =================================================
                 *
                 * Vision équilibrée de l'investissement.
                 */

                case 'GLOBAL':
                    return {
                        opportunity: 0.3,
                        profitability: 0.2,
                        energy: 0.1,
                        amenities: 0.1,
                        liquidity: 0.1,
                        risk: 0.15,
                        confidence: 0.05,
                    };

                /**
                 * =================================================
                 * RENTABILITÉ
                 * =================================================
                 */

                case 'PROFITABILITY':
                    return {
                        opportunity: 0.15,
                        profitability: 0.45,
                        energy: 0.05,
                        amenities: 0.05,
                        liquidity: 0.05,
                        risk: 0.15,
                        confidence: 0.1,
                    };

                /**
                 * =================================================
                 * SÉCURITÉ
                 * =================================================
                 */

                case 'SECURITY':
                    return {
                        opportunity: 0.05,
                        profitability: 0.1,
                        energy: 0.1,
                        amenities: 0.1,
                        liquidity: 0.1,
                        risk: 0.4,
                        confidence: 0.15,
                    };

                /**
                 * =================================================
                 * PLUS-VALUE
                 * =================================================
                 */

                case 'CAPITAL_GAIN':
                    return {
                        opportunity: 0.3,
                        profitability: 0.05,
                        energy: 0.05,
                        amenities: 0.15,
                        liquidity: 0.2,
                        risk: 0.1,
                        confidence: 0.15,
                    };

                /**
                 * =================================================
                 * NÉGOCIATION
                 * =================================================
                 */

                case 'NEGOTIATION':
                    return {
                        opportunity: 0.55,
                        profitability: 0.1,
                        energy: 0.05,
                        amenities: 0.05,
                        liquidity: 0.05,
                        risk: 0.1,
                        confidence: 0.1,
                    };

                /**
                 * =================================================
                 * LIQUIDITÉ
                 * =================================================
                 */

                case 'LIQUIDITY':
                    return {
                        opportunity: 0.1,
                        profitability: 0.1,
                        energy: 0.05,
                        amenities: 0.1,
                        liquidity: 0.45,
                        risk: 0.1,
                        confidence: 0.1,
                    };

                /**
                 * Sécurité TypeScript.
                 */
                default:
                    return {
                        opportunity: 0.3,
                        profitability: 0.2,
                        energy: 0.1,
                        amenities: 0.1,
                        liquidity: 0.1,
                        risk: 0.15,
                        confidence: 0.05,
                    };
            }
        }

        /**
         * ========================================================
         * NORMALISATION D'UN SCORE PONDÉRÉ
         * ========================================================
         *
         * Exemple :
         *
         * 35 / 35 => 100
         * 17.5 / 35 => 50
         * 0 / 35 => 0
         *
         * Si la donnée est absente, on utilise 50.
         *
         * Cela évite de pénaliser artificiellement un bien
         * lorsqu'une catégorie n'a simplement pas pu être calculée.
         */

        private normalizeWeightedScore(value: number | null | undefined, maximum: number): number {
            if (typeof value !== 'number' || !Number.isFinite(value) || maximum <= 0) {
                return 50;
            }

            return this.normalize((value / maximum) * 100);
        }

        /**
         * ========================================================
         * NORMALISATION GÉNÉRALE
         * ========================================================
         */

        private normalize(value: number): number {
            if (!Number.isFinite(value)) {
                return 50;
            }

            return Math.max(0, Math.min(100, value));
        }

        /**
         * ========================================================
         * GAGNANTS PAR CATÉGORIE
         * ========================================================
         *
         * Permet de savoir quel bien est :
         *
         * - meilleure opportunité
         * - meilleure rentabilité
         * - meilleure performance énergétique
         * - meilleures prestations
         * - meilleure liquidité
         * - meilleur profil risque
         * - meilleure confiance
         */

        private getCategoryWinners(results: ComparisonResult[]) {
            const categories = [
                'opportunity',
                'profitability',
                'energy',
                'amenities',
                'liquidity',
                'risk',
                'confidence',
            ] as const;

            const winners: Record<string, string | null> = {};

            for (const category of categories) {
                if (results.length === 0) {
                    winners[category] = null;
                    continue;
                }

                const winner = [...results].sort((a, b) => b.scores[category] - a.scores[category])[0];

                winners[category] = winner?.analysisId ?? null;
            }

            return winners;
        }
    }
