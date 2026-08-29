import { Injectable } from '@nestjs/common';

import { PropertyFeatures } from '../../../meta-data-scrapper/interfaces/property-features.interface';
import { AmenityResult } from 'src/apprexia-engine/interfaces/amenity-result.interface';

interface AmenityRule {
    feature: keyof PropertyFeatures;
    label: string;
    icon: string;
    points: number;
}

const AMENITY_RULES: AmenityRule[] = [
    // =========================================================
    // EXTÉRIEUR
    // =========================================================
    {
        feature: 'terrasse',
        label: 'Terrasse',
        icon: '🌿',
        points: 12,
    },
    {
        feature: 'balcon',
        label: 'Balcon',
        icon: '🏡',
        points: 8,
    },
    {
        feature: 'jardin',
        label: 'Jardin',
        icon: '🌳',
        points: 8,
    },

    // =========================================================
    // CONFORT
    // =========================================================
    {
        feature: 'ascenseur',
        label: 'Ascenseur',
        icon: '🛗',
        points: 8,
    },
    {
        feature: 'cuisineEquipee',
        label: 'Cuisine équipée',
        icon: '🍳',
        points: 6,
    },
    {
        feature: 'climatisation',
        label: 'Climatisation',
        icon: '❄️',
        points: 5,
    },
    {
        feature: 'calme',
        label: 'Calme',
        icon: '🌿',
        points: 4,
    },
    {
        feature: 'lumineux',
        label: 'Lumineux',
        icon: '☀️',
        points: 4,
    },
    {
        feature: 'traversant',
        label: 'Traversant',
        icon: '↔️',
        points: 4,
    },
    {
        feature: 'dernierEtage',
        label: 'Dernier étage',
        icon: '🏙️',
        points: 5,
    },

    // =========================================================
    // ANNEXES
    // =========================================================
    {
        feature: 'cave',
        label: 'Cave',
        icon: '📦',
        points: 3,
    },
    {
        feature: 'dressing',
        label: 'Dressing',
        icon: '👔',
        points: 3,
    },
    {
        feature: 'buanderie',
        label: 'Buanderie',
        icon: '🧺',
        points: 3,
    },
    {
        feature: 'gardien',
        label: 'Gardien',
        icon: '🛡️',
        points: 3,
    },
    {
        feature: 'digicode',
        label: 'Digicode',
        icon: '🔐',
        points: 2,
    },

    // =========================================================
    // STATIONNEMENT
    // =========================================================
    {
        feature: 'garage',
        label: 'Garage',
        icon: '🚗',
        points: 10,
    },
    {
        feature: 'box',
        label: 'Box',
        icon: '🚘',
        points: 8,
    },
    {
        feature: 'parking',
        label: 'Parking',
        icon: '🅿️',
        points: 5,
    },

    // =========================================================
    // ÉTAT
    // =========================================================
    {
        feature: 'renove',
        label: 'Rénové',
        icon: '✨',
        points: 10,
    },
    {
        feature: 'standing',
        label: 'Standing',
        icon: '⭐',
        points: 8,
    },
    {
        feature: 'prestige',
        label: 'Bien de prestige',
        icon: '💎',
        points: 12,
    },

    // =========================================================
    // PREMIUM
    // =========================================================
    {
        feature: 'piscine',
        label: 'Piscine',
        icon: '🏊',
        points: 8,
    },

    // =========================================================
    // TYPOLOGIE
    // =========================================================
    {
        feature: 'loft',
        label: 'Loft',
        icon: '🏢',
        points: 8,
    },
    {
        feature: 'duplex',
        label: 'Duplex',
        icon: '🏠',
        points: 6,
    },
    {
        feature: 'triplex',
        label: 'Triplex',
        icon: '🏘️',
        points: 8,
    },
];

@Injectable()
export class AmenityEngineService {
    /**
     * Calcule la note des prestations / équipements du bien.
     *
     * IMPORTANT :
     * - Le score retourné est toujours compris entre 0 et 100.
     * - Ce service ne gère PAS la pondération du score global Apprexia.
     * - La contribution éventuelle des amenities au score global
     *   est calculée par le ScoreEngine.
     *
     * RÈGLE MÉTIER :
     * - Un bien NEUF et un bien RÉNOVÉ sont deux états différents.
     * - Si le bien est NEUF, la caractéristique "renove" est ignorée,
     *   même si elle a été détectée par erreur dans les métadonnées.
     */
    compute(features?: PropertyFeatures | null, surface?: number, propertyCondition?: string | null): AmenityResult {
        // =====================================================
        // AUCUNE DONNÉE
        // =====================================================

        if (!features) {
            return {
                score: 0,
                level: 'Non renseigné',
                highlights: [],
            };
        }

        // =====================================================
        // NORMALISATION DE L'ÉTAT DU BIEN
        // =====================================================

        const normalizedCondition = propertyCondition?.trim().toUpperCase();

        const isNewProperty = normalizedCondition === 'NEUF';

        let score = 0;

        const highlights: {
            label: string;
            icon: string;
            points: number;
        }[] = [];

        // =====================================================
        // APPLICATION DES RÈGLES
        // =====================================================

        for (const rule of AMENITY_RULES) {
            /**
             * Un bien NEUF ne doit jamais recevoir
             * la prestation "Rénové".
             *
             * Cela protège le moteur contre une extraction
             * incohérente du scraper ou de l'IA :
             *
             * propertyCondition = NEUF
             * renove = true
             *
             * => "Rénové" est ignoré.
             */
            if (rule.feature === 'renove' && isNewProperty) {
                continue;
            }

            if (!features[rule.feature]) {
                continue;
            }

            score += rule.points;

            highlights.push({
                label: rule.label,
                icon: rule.icon,
                points: rule.points,
            });
        }

        // =====================================================
        // VUES
        // =====================================================

        /**
         * Une vue mer est prioritaire sur une vue panoramique.
         */
        if (features.vueMer) {
            score += 8;

            highlights.push({
                label: 'Vue mer',
                icon: '🌊',
                points: 8,
            });
        } else if (features.vuePanoramique) {
            score += 6;

            highlights.push({
                label: 'Vue panoramique',
                icon: '🌄',
                points: 6,
            });
        }

        // =====================================================
        // BONUS SURFACE
        // =====================================================

        /**
         * Bonus historique pour les petites surfaces.
         *
         * Ce bonus améliore légèrement le score mais ne représente
         * pas une prestation détectée. Il n'est donc pas ajouté
         * aux highlights.
         */
        if (typeof surface === 'number' && Number.isFinite(surface) && surface >= 20 && surface <= 70) {
            score += 5;
        }

        // =====================================================
        // NORMALISATION
        // =====================================================

        score = Math.max(0, Math.min(score, 100));

        // =====================================================
        // NIVEAU
        // =====================================================

        let level: AmenityResult['level'];

        if (score >= 80) {
            level = 'Premium';
        } else if (score >= 60) {
            level = 'Très bon';
        } else if (score >= 40) {
            level = 'Correct';
        } else if (score >= 20) {
            level = 'Faible';
        } else {
            level = 'Faible';
        }

        // =====================================================
        // RÉSULTAT
        // =====================================================

        return {
            score,
            level,
            highlights: highlights.sort((a, b) => b.points - a.points).slice(0, 5),
        };
    }
}
