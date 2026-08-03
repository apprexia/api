import { Injectable } from '@nestjs/common';
import { PropertyFeatures } from '../../../services/meta-data-scrapper/interfaces/property-features.interface';
import { AmenityResult } from 'src/apprexia-engine/interfaces/amenity-result.interface';

interface AmenityRule {
    feature: keyof PropertyFeatures;
    label: string;
    icon: string;
    points: number;
}

const AMENITY_RULES: AmenityRule[] = [
    // ===============================
    // EXTERIEUR
    // ===============================
    { feature: 'terrasse', label: 'Terrasse', icon: '🌿', points: 12 },
    { feature: 'balcon', label: 'Balcon', icon: '🏡', points: 8 },
    { feature: 'jardin', label: 'Jardin', icon: '🌳', points: 8 },

    // ===============================
    // CONFORT
    // ===============================
    { feature: 'ascenseur', label: 'Ascenseur', icon: '🛗', points: 8 },
    { feature: 'cuisineEquipee', label: 'Cuisine équipée', icon: '🍳', points: 6 },
    { feature: 'climatisation', label: 'Climatisation', icon: '❄️', points: 5 },
    { feature: 'calme', label: 'Calme', icon: '🌿', points: 4 },
    { feature: 'lumineux', label: 'Lumineux', icon: '☀️', points: 4 },
    { feature: 'traversant', label: 'Traversant', icon: '↔️', points: 4 },
    { feature: 'dernierEtage', label: 'Dernier étage', icon: '🏙️', points: 5 },

    // ===============================
    // ANNEXES
    // ===============================
    { feature: 'cave', label: 'Cave', icon: '📦', points: 3 },
    { feature: 'dressing', label: 'Dressing', icon: '👔', points: 3 },
    { feature: 'buanderie', label: 'Buanderie', icon: '🧺', points: 3 },
    { feature: 'gardien', label: 'Gardien', icon: '🛡️', points: 3 },
    { feature: 'digicode', label: 'Digicode', icon: '🔐', points: 2 },

    // ===============================
    // STATIONNEMENT
    // ===============================
    { feature: 'garage', label: 'Garage', icon: '🚗', points: 10 },
    { feature: 'box', label: 'Box', icon: '🚘', points: 8 },
    { feature: 'parking', label: 'Parking', icon: '🅿️', points: 5 },

    // ===============================
    // ETAT
    // ===============================
    { feature: 'renove', label: 'Rénové', icon: '✨', points: 10 },
    { feature: 'standing', label: 'Standing', icon: '⭐', points: 8 },
    { feature: 'prestige', label: 'Bien de prestige', icon: '💎', points: 12 },

    // ===============================
    // PREMIUM
    // ===============================
    { feature: 'piscine', label: 'Piscine', icon: '🏊', points: 8 },

    // ===============================
    // TYPOLOGIE
    // ===============================
    { feature: 'loft', label: 'Loft', icon: '🏢', points: 8 },
    { feature: 'duplex', label: 'Duplex', icon: '🏠', points: 6 },
    { feature: 'triplex', label: 'Triplex', icon: '🏘️', points: 8 },
];

@Injectable()
export class AmenityEngineService {
    compute(features?: PropertyFeatures | null, surface?: number): AmenityResult {
        if (!features) {
            return {
                score: 50,
                level: 'Non renseigné',
                highlights: [],
            };
        }

        let score = 0;

        const highlights: {
            label: string;
            icon: string;
            points: number;
        }[] = [];

        // Application des règles
        for (const rule of AMENITY_RULES) {
            if (!features[rule.feature]) continue;

            score += rule.points;

            highlights.push({
                label: rule.label,
                icon: rule.icon,
                points: rule.points,
            });
        }

        /**
         * Cas particuliers
         */

        // Vue mer prioritaire sur vue panoramique
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

        // Bonus investisseur
        if (surface && surface >= 20 && surface <= 70) {
            score += 5;
        }

        score = Math.min(score, 100);

        return {
            score,

            level: score >= 80 ? 'Premium' : score >= 60 ? 'Très bon' : score >= 40 ? 'Correct' : 'Faible',

            highlights: highlights.sort((a, b) => b.points - a.points).slice(0, 5),
        };
    }
}
