import { Injectable } from '@nestjs/common';
import { PropertyFeatures } from '../../../meta-data-scrapper/interfaces/property-features.interface';

@Injectable()
export class PropertyValueAdjustmentEngineService {
    compute(params: {
        features?: PropertyFeatures | null;
        terrain?: number | null;
        surface?: number | null;
        typeLocal?: string | null;
    }): number {
        const { features, terrain, surface, typeLocal } = params;
        if (!features) {
            return 1;
        }

        let adjustment = 1;

        // ==========================================
        // VUES (on garde uniquement la meilleure)
        // ==========================================

        if (features.vueMer) {
            adjustment += 0.08;
        } else if (features.vuePanoramique) {
            adjustment += 0.05;
        } else if (features.vueMontagne) {
            adjustment += 0.03;
        } else if (features.vueDegagee) {
            adjustment += 0.02;
        }

        // ==========================================
        // EXTERIEURS
        // ==========================================

        if (features.terrasse) adjustment += 0.02;
        if (features.balcon) adjustment += 0.01;
        if (features.jardin) adjustment += 0.03;
        if (features.patio) adjustment += 0.01;

        // ==========================================
        // TERRAIN (MAISON UNIQUEMENT)
        // ==========================================

        if (typeLocal?.toLowerCase().includes('maison') && terrain && surface) {
            const ratioTerrain = terrain / surface;

            // Terrain intéressant
            if (terrain >= 400 && ratioTerrain >= 5) {
                adjustment += 0.04;
            }

            // Grand terrain rare
            if (terrain >= 800 && ratioTerrain >= 10) {
                adjustment += 0.06;
            }

            // Très grand terrain
            if (terrain >= 1500) {
                adjustment += 0.1;
            }
        }

        // ==========================================
        // PRESTATIONS PREMIUM
        // ==========================================

        if (features.piscine) adjustment += 0.03;
        if (features.jacuzzi) adjustment += 0.02;
        if (features.spa) adjustment += 0.02;
        if (features.sauna) adjustment += 0.01;

        // ==========================================
        // STATIONNEMENT
        // ==========================================

        if (features.garage) adjustment += 0.02;
        else if (features.parking) adjustment += 0.01;

        if (features.box) adjustment += 0.01;

        // ==========================================
        // ANNEXES
        // ==========================================

        if (features.cave) adjustment += 0.01;
        if (features.grenier) adjustment += 0.01;

        // ==========================================
        // CONFORT
        // ==========================================

        if (features.ascenseur) adjustment += 0.01;
        if (features.climatisation) adjustment += 0.01;
        if (features.cheminee) adjustment += 0.01;
        if (features.cuisineEquipee) adjustment += 0.01;
        if (features.dressing) adjustment += 0.01;
        if (features.buanderie) adjustment += 0.01;

        // ==========================================
        // TYPOLOGIE
        // ==========================================

        if (features.duplex) adjustment += 0.02;
        if (features.triplex) adjustment += 0.03;
        if (features.loft) adjustment += 0.02;

        // ==========================================
        // QUALITES
        // ==========================================

        if (features.dernierEtage) adjustment += 0.02;
        if (features.traversant) adjustment += 0.01;
        if (features.lumineux) adjustment += 0.01;
        if (features.calme) adjustment += 0.01;

        // ==========================================
        // QUALITE GENERALE
        // ==========================================

        if (features.renove) adjustment += 0.03;
        if (features.standing) adjustment += 0.03;
        if (features.prestige) adjustment += 0.05;

        // Limite de sécurité : +20 % maximum
        return Math.min(adjustment, 1.2);
    }

    adjustValue(value: number, coefficient: number): number {
        return Math.round(value * coefficient);
    }
}
