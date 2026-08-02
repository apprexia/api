import { Injectable } from '@nestjs/common';
import { PropertyFeatures } from '../../../services/meta-data-scrapper/interfaces/property-features.interface';
import { AmenityResult } from 'src/apprexia-engine/interfaces/amenity-result.interface';

export interface AmenityScoreResult {
  score: number;
  level: string;

  highlights: {
    label: string;
    icon: string;
    points: number;
  }[];
}

@Injectable()
export class AmenityEngineService {
  compute(features?: PropertyFeatures | null, surface?: number): AmenityResult {
    if (!features) {
      return {
        score: 0,
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

    /**
     * VUE
     * Max 20 points
     */
    if (features.vueMer) {
      score += 20;
      highlights.push({
        label: 'Vue mer',
        icon: '🌊',
        points: 20,
      });
    } else if (features.vuePanoramique) {
      score += 15;
      highlights.push({
        label: 'Vue panoramique',
        icon: '🌄',
        points: 15,
      });
    } else if (features.vueMontagne) {
      score += 10;
      highlights.push({
        label: 'Vue montagne',
        icon: '⛰️',
        points: 10,
      });
    } else if (features.vueDegagee) {
      score += 8;
      highlights.push({
        label: 'Vue dégagée',
        icon: '🌅',
        points: 8,
      });
    }

    /**
     * EXTÉRIEUR
     * Max 20 points
     */
    if (features.terrasse) {
      score += 10;
      highlights.push({
        label: 'Terrasse',
        icon: '🌿',
        points: 10,
      });
    }

    if (features.jardin) {
      score += 10;
      highlights.push({
        label: 'Jardin',
        icon: '🌳',
        points: 10,
      });
    }

    if (features.balcon) {
      score += 5;
      highlights.push({
        label: 'Balcon',
        icon: '🏡',
        points: 5,
      });
    }

    /**
     * LOISIRS PREMIUM
     * Max 15 points
     */
    if (features.piscine) {
      score += 12;
      highlights.push({
        label: 'Piscine',
        icon: '🏊',
        points: 12,
      });
    }

    if (features.jacuzzi || features.spa) {
      score += 5;
      highlights.push({
        label: 'Espace bien-être',
        icon: '♨️',
        points: 5,
      });
    }

    /**
     * STATIONNEMENT
     * Max 15 points
     */
    if (features.garage) {
      score += 10;
      highlights.push({
        label: 'Garage',
        icon: '🚗',
        points: 10,
      });
    }

    if (features.box) {
      score += 7;
      highlights.push({
        label: 'Box',
        icon: '🚘',
        points: 7,
      });
    }

    if (features.parking) {
      score += 5;
      highlights.push({
        label: 'Parking',
        icon: '🅿️',
        points: 5,
      });
    }

    /**
     * CONFORT
     * Max 15 points
     */
    if (features.climatisation) {
      score += 5;
      highlights.push({
        label: 'Climatisation',
        icon: '❄️',
        points: 5,
      });
    }

    if (features.cuisineEquipee) {
      score += 3;
      highlights.push({
        label: 'Cuisine équipée',
        icon: '🍳',
        points: 3,
      });
    }

    if (features.ascenseur) {
      score += 3;
      highlights.push({
        label: 'Ascenseur',
        icon: '🛗',
        points: 3,
      });
    }

    if (features.cheminee) {
      score += 2;
      highlights.push({
        label: 'Cheminée',
        icon: '🔥',
        points: 2,
      });
    }

    /**
     * QUALITÉ
     * Max 15 points
     */
    if (features.renove) {
      score += 8;
      highlights.push({
        label: 'Rénové',
        icon: '✨',
        points: 8,
      });
    }

    if (features.standing) {
      score += 8;
      highlights.push({
        label: 'Standing',
        icon: '⭐',
        points: 8,
      });
    }

    if (features.prestige) {
      score += 12;
      highlights.push({
        label: 'Prestige',
        icon: '💎',
        points: 12,
      });
    }

    /**
     * BONUS TYPOLOGIE
     */
    if (features.duplex) {
      score += 5;
      highlights.push({
        label: 'Duplex',
        icon: '🏠',
        points: 5,
      });
    }

    if (features.loft) {
      score += 5;
      highlights.push({
        label: 'Loft',
        icon: '🏢',
        points: 5,
      });
    }

    /**
     * BONUS SURFACE
     */
    if (surface && surface >= 18 && surface <= 70) {
      score += 3;
    }

    return {
      score: Math.min(100, score),

      level:
        score >= 90
          ? 'Premium'
          : score >= 75
            ? 'Très bon'
            : score >= 60
              ? 'Bon'
              : score >= 40
                ? 'Correct'
                : 'Faible',

      highlights: highlights.sort((a, b) => b.points - a.points).slice(0, 5),
    };
  }
}
