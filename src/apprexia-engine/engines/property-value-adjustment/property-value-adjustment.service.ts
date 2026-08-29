import { Injectable } from '@nestjs/common';
import { PropertyFeatures } from '../../../meta-data-scrapper/interfaces/property-features.interface';

@Injectable()
export class PropertyValueAdjustmentEngineService {
    compute(params: {
        features?: PropertyFeatures | null;
        terrain?: number | null;
        surface?: number | null;
        typeLocal?: string | null;
        propertyCondition?: 'NEUF' | 'ANCIEN' | 'INCONNU' | null;
    }): number {
        const { features, terrain, surface, typeLocal, propertyCondition } = params;

        let adjustment = 1;

        // ==========================================
        // ÉTAT DU BIEN
        // ==========================================
        //
        // Le neuf constitue une prime de valorisation
        // par rapport aux transactions DVF historiques.
        //
        // ANCIEN / INCONNU = aucun ajustement.
        //
        // Important :
        // NEUF et RÉNOVÉ ne sont pas cumulés.
        // ==========================================

        if (propertyCondition === 'NEUF') {
            adjustment += 0.1;
        }

        // ==========================================
        // VUES
        // On garde uniquement la meilleure
        // ==========================================

        if (features?.vueMer) {
            adjustment += 0.08;
        } else if (features?.vuePanoramique) {
            adjustment += 0.05;
        } else if (features?.vueMontagne) {
            adjustment += 0.03;
        } else if (features?.vueDegagee) {
            adjustment += 0.02;
        }

        // ==========================================
        // EXTÉRIEURS
        // ==========================================

        if (features?.terrasse) adjustment += 0.02;
        if (features?.balcon) adjustment += 0.01;
        if (features?.jardin) adjustment += 0.03;
        if (features?.patio) adjustment += 0.01;

        // ==========================================
        // TERRAIN
        // Maison uniquement
        // ==========================================

        if (typeLocal?.toLowerCase().includes('maison') && terrain && surface) {
            const ratioTerrain = terrain / surface;

            if (terrain >= 1500) {
                adjustment += 0.1;
            } else if (terrain >= 800 && ratioTerrain >= 10) {
                adjustment += 0.06;
            } else if (terrain >= 400 && ratioTerrain >= 5) {
                adjustment += 0.04;
            }
        }

        // ==========================================
        // PRESTATIONS PREMIUM
        // ==========================================

        if (features?.piscine) adjustment += 0.03;
        if (features?.jacuzzi) adjustment += 0.02;
        if (features?.spa) adjustment += 0.02;
        if (features?.sauna) adjustment += 0.01;

        // ==========================================
        // STATIONNEMENT
        // ==========================================

        if (features?.garage) {
            adjustment += 0.02;
        } else if (features?.parking) {
            adjustment += 0.01;
        }

        if (features?.box) adjustment += 0.01;

        // ==========================================
        // ANNEXES
        // ==========================================

        if (features?.cave) adjustment += 0.01;
        if (features?.grenier) adjustment += 0.01;

        // ==========================================
        // CONFORT
        // ==========================================

        if (features?.ascenseur) adjustment += 0.01;
        if (features?.climatisation) adjustment += 0.01;
        if (features?.cheminee) adjustment += 0.01;
        if (features?.cuisineEquipee) adjustment += 0.01;
        if (features?.dressing) adjustment += 0.01;
        if (features?.buanderie) adjustment += 0.01;

        // ==========================================
        // TYPOLOGIE
        // ==========================================

        if (features?.duplex) adjustment += 0.02;
        if (features?.triplex) adjustment += 0.03;
        if (features?.loft) adjustment += 0.02;

        // ==========================================
        // QUALITÉS
        // ==========================================

        if (features?.dernierEtage) adjustment += 0.02;
        if (features?.traversant) adjustment += 0.01;
        if (features?.lumineux) adjustment += 0.01;
        if (features?.calme) adjustment += 0.01;

        // ==========================================
        // QUALITÉ GÉNÉRALE
        // ==========================================

        // On ne cumule pas "NEUF" et "RÉNOVÉ".
        //
        // Si le bien est ancien/rénové :
        // +3 %
        //
        // Si le bien est neuf :
        // la prime de +10 % du dessus suffit.
        // ==========================================

        if (propertyCondition !== 'NEUF' && features?.renove) {
            adjustment += 0.03;
        }

        if (features?.standing) adjustment += 0.03;
        if (features?.prestige) adjustment += 0.05;

        // ==========================================
        // LIMITE DE SÉCURITÉ
        // ==========================================

        return Math.min(adjustment, 1.2);
    }

    adjustValue(value: number, coefficient: number): number {
        return Math.round(value * coefficient);
    }
}
