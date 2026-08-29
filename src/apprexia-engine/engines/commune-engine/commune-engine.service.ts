import { Injectable } from '@nestjs/common';
import { CommuneIndicator } from '@prisma/client';
import { CommuneAnalysis } from '../../interfaces/commune-analysis.interface';

@Injectable()
export class CommuneEngineService {
    compute(commune: CommuneIndicator | null): CommuneAnalysis | null {
        if (!commune) {
            return null;
        }

        // =========================================================
        // DONNÉES
        // =========================================================

        const dvfTransactions = commune.dvfTransactions ?? null;
        const population = commune.population ?? null;
        const evolutionPopulation = commune.evolutionPopulation5Years ?? null;
        const priceEvolution = commune.priceEvolution5Years ?? null;

        const fiberCoverage = commune.fiberCoverage ?? null;
        const schoolIndex = commune.schoolIndex ?? null;
        const doctorAccess = commune.doctorAccess ?? null;

        const floodRisk = commune.floodRisk ?? null;
        const icpeSurface = commune.icpeSurface ?? null;
        const sevesoSurface = commune.sevesoSurface ?? null;

        const propertyTaxRate = commune.propertyTaxRate ?? null;

        // =========================================================
        // SCORES INTERNES
        //
        // Chaque catégorie possède son propre poids dans le score
        // global sur 100.
        //
        // Immobilier       : 35 points
        // Démographie      : 20 points
        // Qualité de vie   : 20 points
        // Environnement    : 15 points
        // Fiscalité        : 10 points
        //
        // TOTAL             : 100 points
        // =========================================================

        let realEstate = 0;
        let demographics = 0;
        let qualityOfLife = 0;
        let environment = 0;
        let taxation = 0;

        const strengths: string[] = [];
        const weaknesses: string[] = [];

        // =========================================================
        // IMMOBILIER — 35 POINTS
        // =========================================================

        let realEstateDataAvailable = false;

        // ---------------------------------------------------------
        // Évolution des prix
        // ---------------------------------------------------------

        if (priceEvolution !== null) {
            realEstateDataAvailable = true;

            if (priceEvolution >= 15) {
                realEstate += 20;

                strengths.push(`Marché immobilier très dynamique (+${priceEvolution.toFixed(1)} % sur 5 ans)`);
            } else if (priceEvolution >= 5) {
                realEstate += 15;

                strengths.push(`Marché immobilier en progression (+${priceEvolution.toFixed(1)} % sur 5 ans)`);
            } else if (priceEvolution >= 0) {
                realEstate += 10;

                strengths.push(`Marché immobilier stable (+${priceEvolution.toFixed(1)} % sur 5 ans)`);
            } else if (priceEvolution >= -5) {
                realEstate += 7;

                weaknesses.push(`Marché immobilier légèrement en recul (${priceEvolution.toFixed(1)} % sur 5 ans)`);
            } else {
                realEstate += 4;

                weaknesses.push(`Marché immobilier en recul (${priceEvolution.toFixed(1)} % sur 5 ans)`);
            }
        }

        // ---------------------------------------------------------
        // Liquidité du marché
        // ---------------------------------------------------------

        if (dvfTransactions !== null) {
            realEstateDataAvailable = true;

            if (dvfTransactions >= 500) {
                realEstate += 15;

                strengths.push('Marché immobilier très liquide');
            } else if (dvfTransactions >= 200) {
                realEstate += 11;

                strengths.push('Marché immobilier liquide');
            } else if (dvfTransactions >= 100) {
                realEstate += 8;
            } else if (dvfTransactions >= 50) {
                realEstate += 5;
            } else {
                realEstate += 2;

                weaknesses.push('Faible volume de transactions immobilières');
            }
        }

        // Sécurité supplémentaire sur le plafond interne.
        realEstate = Math.min(realEstate, 35);

        // =========================================================
        // DÉMOGRAPHIE — 20 POINTS
        // =========================================================

        let demographicsDataAvailable = false;

        // ---------------------------------------------------------
        // Population
        // ---------------------------------------------------------

        if (population !== null) {
            demographicsDataAvailable = true;

            if (population >= 50000) {
                demographics += 10;

                strengths.push('Commune à forte population');
            } else if (population >= 20000) {
                demographics += 8;

                strengths.push('Bassin de population significatif');
            } else if (population >= 10000) {
                demographics += 7;
            } else if (population >= 5000) {
                demographics += 5;
            } else {
                demographics += 3;
            }
        }

        // ---------------------------------------------------------
        // Évolution démographique
        // ---------------------------------------------------------

        if (evolutionPopulation !== null) {
            demographicsDataAvailable = true;

            if (evolutionPopulation >= 5) {
                demographics += 10;

                strengths.push(`Population en forte croissance (+${evolutionPopulation.toFixed(1)} % sur 5 ans)`);
            } else if (evolutionPopulation >= 2) {
                demographics += 9;

                strengths.push(`Population en croissance (+${evolutionPopulation.toFixed(1)} % sur 5 ans)`);
            } else if (evolutionPopulation >= 0) {
                demographics += 7;
            } else if (evolutionPopulation >= -2) {
                demographics += 4;

                weaknesses.push(`Population légèrement en baisse (${evolutionPopulation.toFixed(1)} % sur 5 ans)`);
            } else {
                demographics += 2;

                weaknesses.push(`Population en baisse (${evolutionPopulation.toFixed(1)} % sur 5 ans)`);
            }
        }

        demographics = Math.min(demographics, 20);

        // =========================================================
        // QUALITÉ DE VIE — 20 POINTS
        // =========================================================

        let qualityOfLifeDataAvailable = false;

        // ---------------------------------------------------------
        // Fibre
        // ---------------------------------------------------------

        if (fiberCoverage !== null) {
            qualityOfLifeDataAvailable = true;

            if (fiberCoverage >= 90) {
                qualityOfLife += 7;

                strengths.push('Excellente couverture fibre');
            } else if (fiberCoverage >= 70) {
                qualityOfLife += 5;
            } else if (fiberCoverage >= 50) {
                qualityOfLife += 3;
            } else {
                qualityOfLife += 1;

                weaknesses.push('Couverture fibre limitée');
            }
        }

        // ---------------------------------------------------------
        // Écoles
        // ---------------------------------------------------------

        if (schoolIndex !== null) {
            qualityOfLifeDataAvailable = true;

            if (schoolIndex >= 120) {
                qualityOfLife += 7;

                strengths.push('Très bonne offre scolaire');
            } else if (schoolIndex >= 100) {
                qualityOfLife += 6;

                strengths.push('Bonne offre scolaire');
            } else if (schoolIndex >= 80) {
                qualityOfLife += 4;
            } else {
                qualityOfLife += 2;

                weaknesses.push('Offre scolaire limitée');
            }
        }

        // ---------------------------------------------------------
        // Médecins
        // ---------------------------------------------------------

        if (doctorAccess !== null) {
            qualityOfLifeDataAvailable = true;

            if (doctorAccess >= 3.5) {
                qualityOfLife += 6;

                strengths.push('Bonne offre médicale');
            } else if (doctorAccess >= 2.5) {
                qualityOfLife += 4;
            } else if (doctorAccess >= 1.5) {
                qualityOfLife += 2;
            } else {
                qualityOfLife += 1;

                weaknesses.push('Accès aux soins limité');
            }
        }

        qualityOfLife = Math.min(qualityOfLife, 20);

        // =========================================================
        // ENVIRONNEMENT — 15 POINTS
        // =========================================================

        let environmentDataAvailable = false;

        // ---------------------------------------------------------
        // Risque inondation
        // ---------------------------------------------------------

        if (floodRisk !== null) {
            environmentDataAvailable = true;

            if (floodRisk <= 1) {
                environment += 6;
            } else if (floodRisk <= 2) {
                environment += 4;
            } else if (floodRisk <= 3) {
                environment += 2;

                weaknesses.push('Risque d’inondation modéré');
            } else {
                weaknesses.push('Risque d’inondation élevé');
            }
        }

        // ---------------------------------------------------------
        // Activités ICPE
        // ---------------------------------------------------------

        if (icpeSurface !== null) {
            environmentDataAvailable = true;

            if (icpeSurface === 0) {
                environment += 5;
            } else if (icpeSurface < 10) {
                environment += 4;
            } else if (icpeSurface < 50) {
                environment += 2;

                weaknesses.push('Présence d’activités industrielles');
            } else {
                weaknesses.push('Présence importante d’activités industrielles');
            }
        }

        // ---------------------------------------------------------
        // Sites Seveso
        // ---------------------------------------------------------

        if (sevesoSurface !== null) {
            environmentDataAvailable = true;

            if (sevesoSurface === 0) {
                environment += 4;
            } else if (sevesoSurface < 10) {
                environment += 2;

                weaknesses.push('Présence de sites Seveso à proximité');
            } else {
                weaknesses.push('Présence de sites Seveso');
            }
        }

        environment = Math.min(environment, 15);

        // =========================================================
        // FISCALITÉ — 10 POINTS
        // =========================================================

        let taxationDataAvailable = false;

        if (propertyTaxRate !== null) {
            taxationDataAvailable = true;

            if (propertyTaxRate < 30) {
                taxation = 10;

                strengths.push('Fiscalité locale avantageuse');
            } else if (propertyTaxRate < 40) {
                taxation = 7;
            } else if (propertyTaxRate < 50) {
                taxation = 5;
            } else {
                taxation = 2;

                weaknesses.push('Fiscalité locale élevée');
            }
        }

        // =========================================================
        // SCORE GLOBAL BRUT
        // =========================================================

        const rawScore = realEstate + demographics + qualityOfLife + environment + taxation;

        // =========================================================
        // NORMALISATION DU SCORE GLOBAL
        //
        // On ne pénalise pas une commune lorsqu'une catégorie
        // entière ne dispose d'aucune donnée.
        // =========================================================

        let availableMaximum = 0;

        if (realEstateDataAvailable) {
            availableMaximum += 35;
        }

        if (demographicsDataAvailable) {
            availableMaximum += 20;
        }

        if (qualityOfLifeDataAvailable) {
            availableMaximum += 20;
        }

        if (environmentDataAvailable) {
            availableMaximum += 15;
        }

        if (taxationDataAvailable) {
            availableMaximum += 10;
        }

        const score = availableMaximum > 0 ? Math.min(100, Math.round((rawScore / availableMaximum) * 100)) : 0;

        // =========================================================
        // NORMALISATION DES SOUS-SCORES SUR 20
        //
        // L'utilisateur voit TOUJOURS des notes sur 20.
        //
        // Les barèmes internes restent :
        //
        // Immobilier       : 35
        // Démographie      : 20
        // Qualité de vie   : 20
        // Environnement    : 15
        // Fiscalité        : 10
        //
        // Ils sont ensuite convertis en /20 uniquement pour
        // l'affichage et la réponse de l'API.
        // =========================================================

        const realEstateScore = Math.round((realEstate / 35) * 20);

        const demographicsScore = Math.round((demographics / 20) * 20);

        const qualityOfLifeScore = Math.round((qualityOfLife / 20) * 20);

        const environmentScore = Math.round((environment / 15) * 20);

        const taxationScore = Math.round((taxation / 10) * 20);

        // =========================================================
        // SÉCURITÉ DES SCORES /20
        // =========================================================

        const normalizedRealEstate = Math.min(20, Math.max(0, realEstateScore));

        const normalizedDemographics = Math.min(20, Math.max(0, demographicsScore));

        const normalizedQualityOfLife = Math.min(20, Math.max(0, qualityOfLifeScore));

        const normalizedEnvironment = Math.min(20, Math.max(0, environmentScore));

        const normalizedTaxation = Math.min(20, Math.max(0, taxationScore));

        // =========================================================
        // NIVEAU GLOBAL
        // =========================================================

        let level: CommuneAnalysis['level'];

        if (score >= 80) {
            level = 'Excellent';
        } else if (score >= 65) {
            level = 'Bon';
        } else if (score >= 45) {
            level = 'Moyen';
        } else {
            level = 'Faible';
        }

        // =========================================================
        // RETOUR
        // =========================================================

        return {
            score,

            level,

            strengths,

            weaknesses,

            breakdown: {
                // TOUS LES SOUS-SCORES SONT MAINTENANT SUR 20

                realEstate: normalizedRealEstate,

                demographics: normalizedDemographics,

                accessibility: normalizedQualityOfLife,

                environment: normalizedEnvironment,

                taxation: normalizedTaxation,
            },
        };
    }
}
