import { Injectable } from '@nestjs/common';

import { EngineContext } from '../../interfaces/engine-context.interface';

@Injectable()
export class RiskEngineService {
    /**
     * Calcule un niveau de risque de 0 à 100.
     *
     * 0   = risque très faible
     * 100 = risque très élevé
     *
     * IMPORTANT :
     * Ce niveau est ensuite converti en riskScore /20
     * dans le ScoreEngine.
     */
    compute(context: EngineContext): number {
        const analysis = context.analysis;
        const metadata = context.metadata;

        let risk = 0;

        // =====================================================
        // 1. PRIX / VALORISATION
        // =====================================================

        const askingPrice = analysis.askingPrice;

        const referenceValue = analysis.valuation?.adjustedValue ?? analysis.dvfReferenceValue ?? 0;

        if (askingPrice > 0 && referenceValue > 0) {
            const priceDelta = ((askingPrice - referenceValue) / referenceValue) * 100;

            if (priceDelta > 25) {
                risk += 30;
            } else if (priceDelta > 15) {
                risk += 20;
            } else if (priceDelta > 10) {
                risk += 12;
            } else if (priceDelta > 5) {
                risk += 6;
            }
        }

        // =====================================================
        // 2. RENDEMENT LOCATIF
        // =====================================================

        const grossYield = analysis.grossYield;

        if (grossYield != null) {
            if (grossYield < 3) {
                risk += 20;
            } else if (grossYield < 3.5) {
                risk += 14;
            } else if (grossYield < 4) {
                risk += 8;
            } else if (grossYield < 4.5) {
                risk += 4;
            }
        }

        // =====================================================
        // 3. PERFORMANCE ÉNERGÉTIQUE
        // =====================================================

        const dpe = metadata.dpe ?? analysis.dpe;

        if (dpe) {
            switch (dpe.toUpperCase()) {
                case 'G':
                    risk += 15;
                    break;

                case 'F':
                    risk += 12;
                    break;

                case 'E':
                    risk += 7;
                    break;

                case 'D':
                    risk += 3;
                    break;

                case 'A':
                case 'B':
                case 'C':
                    break;
            }
        }

        // =====================================================
        // 4. LIQUIDITÉ DU MARCHÉ
        // =====================================================

        const transactions = context.dvf?.count ?? context.commune?.dvfTransactions ?? 0;

        if (transactions <= 2) {
            risk += 12;
        } else if (transactions <= 5) {
            risk += 8;
        } else if (transactions <= 10) {
            risk += 4;
        }

        // =====================================================
        // 5. LOCALISATION
        // =====================================================
        //
        // EngineContext ne possède pas de "location".
        //
        // On utilise donc le localScore de la commune
        // lorsqu'il est disponible.
        //
        // =====================================================

        const locationScore = context.commune?.localScore;

        if (locationScore != null) {
            if (locationScore < 30) {
                risk += 12;
            } else if (locationScore < 45) {
                risk += 8;
            } else if (locationScore < 60) {
                risk += 4;
            }
        }

        // =====================================================
        // 6. DONNÉES MANQUANTES
        // =====================================================

        if (!askingPrice || askingPrice <= 0) {
            risk += 10;
        }

        if (!referenceValue || referenceValue <= 0) {
            risk += 10;
        }

        // =====================================================
        // 7. RISQUES COMMUNAUX
        // =====================================================

        const floodRisk = context.commune?.floodRisk;

        if (floodRisk != null) {
            if (floodRisk >= 5) {
                risk += 10;
            } else if (floodRisk >= 3) {
                risk += 6;
            } else if (floodRisk >= 1) {
                risk += 2;
            }
        }

        // =====================================================
        // 8. SÉCURISATION
        // =====================================================

        return Math.min(100, Math.max(0, Math.round(risk)));
    }
}
