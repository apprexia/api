import { Injectable } from '@nestjs/common';
import { PrismaService } from '../services/prisma/prisma.service';

@Injectable()
export class CommuneIndicatorService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Recherche par code INSEE
     */
    async findByInsee(codeInsee: string) {
        return this.prisma.communeIndicator.findUnique({
            where: {
                codeInsee,
            },
        });
    }

    /**
     * Recherche du contexte local à partir de la ville
     * et, si disponible, du code postal.
     *
     * La recherche utilise :
     * 1. Le nom normalisé de la commune
     * 2. Le département déduit du code postal
     * 3. Une gestion spécifique des arrondissements
     *    de Paris, Marseille et Lyon
     *
     * En cas d'ambiguïté impossible à résoudre,
     * la méthode retourne null plutôt que de sélectionner
     * arbitrairement la première commune.
     */
    async findByLocation(city?: string, codePostal?: string) {
        console.log('COMMUNE LOOKUP', {
            city,
            codePostal,
        });

        if (!city) {
            return null;
        }

        // =====================================================
        // 1. NORMALISATION DE LA VILLE
        // =====================================================

        const cleanCity = this.normalizeCity(city);

        console.log('COMMUNE NORMALIZED', {
            original: city,
            normalized: cleanCity,
        });

        // =====================================================
        // 2. RECHERCHE PAR NOM DE COMMUNE
        // =====================================================

        const communes = await this.prisma.communeIndicator.findMany({
            where: {
                commune: cleanCity,
            },
        });

        console.log('COMMUNE MATCHES', {
            city: cleanCity,
            count: communes.length,
            communes: communes.map((c) => ({
                codeInsee: c.codeInsee,
                commune: c.commune,
                codeDepartement: c.codeDepartement,
            })),
        });

        // =====================================================
        // 3. AUCUNE COMMUNE
        // =====================================================

        if (communes.length === 0) {
            console.warn(`⚠️ Aucune commune trouvée pour "${cleanCity}"`);

            return null;
        }

        // =====================================================
        // 4. UNE SEULE COMMUNE
        // =====================================================

        if (communes.length === 1) {
            console.log('✅ Commune unique trouvée', {
                codeInsee: communes[0].codeInsee,
                commune: communes[0].commune,
                codeDepartement: communes[0].codeDepartement,
            });

            return communes[0];
        }

        // =====================================================
        // 5. PLUSIEURS COMMUNES
        //    → UTILISATION DU CODE POSTAL
        // =====================================================

        if (codePostal) {
            const cp = codePostal.replace(/\s/g, '');

            let codeDepartement: string | null = null;

            // ===================================================
            // France métropolitaine
            // ===================================================

            if (/^\d{5}$/.test(cp)) {
                // DOM
                if (
                    cp.startsWith('971') ||
                    cp.startsWith('972') ||
                    cp.startsWith('973') ||
                    cp.startsWith('974') ||
                    cp.startsWith('976')
                ) {
                    codeDepartement = cp.substring(0, 3);
                }

                // Corse
                else if (cp.startsWith('200') || cp.startsWith('201') || cp.startsWith('202')) {
                    codeDepartement = null;
                }

                // Métropole
                else {
                    codeDepartement = cp.substring(0, 2);
                }
            }

            // ===================================================
            // 5A. Recherche par département
            // ===================================================

            if (codeDepartement) {
                console.log('COMMUNE DEPARTMENT LOOKUP', {
                    city: cleanCity,
                    codePostal: cp,
                    codeDepartement,
                });

                const communeByDepartment = communes.find((commune) => commune.codeDepartement === codeDepartement);

                if (communeByDepartment) {
                    console.log('✅ COMMUNE FOUND BY DEPARTMENT', {
                        codeInsee: communeByDepartment.codeInsee,
                        commune: communeByDepartment.commune,
                        codeDepartement: communeByDepartment.codeDepartement,
                        codePostal: cp,
                    });

                    return communeByDepartment;
                }
            }

            // ===================================================
            // 5B. PARIS
            // ===================================================

            const cpNumber = Number(cp);

            if (cpNumber >= 75001 && cpNumber <= 75020) {
                const commune = communes.find((c) => {
                    const insee = Number(c.codeInsee);

                    return insee === 75100 + (cpNumber - 75000);
                });

                if (commune) {
                    console.log('✅ COMMUNE FOUND BY PARIS ARRONDISSEMENT', {
                        codeInsee: commune.codeInsee,
                        commune: commune.commune,
                        codePostal: cp,
                    });

                    return commune;
                }
            }

            // ===================================================
            // 5C. MARSEILLE
            // ===================================================

            if (cpNumber >= 13001 && cpNumber <= 13016) {
                const commune = communes.find((c) => {
                    const insee = Number(c.codeInsee);

                    return insee === 13200 + (cpNumber - 13000);
                });

                if (commune) {
                    console.log('✅ COMMUNE FOUND BY MARSEILLE ARRONDISSEMENT', {
                        codeInsee: commune.codeInsee,
                        commune: commune.commune,
                        codePostal: cp,
                    });

                    return commune;
                }
            }

            // ===================================================
            // 5D. LYON
            // ===================================================

            if (cpNumber >= 69001 && cpNumber <= 69009) {
                const commune = communes.find((c) => {
                    const insee = Number(c.codeInsee);

                    return insee === 69380 + (cpNumber - 69000);
                });

                if (commune) {
                    console.log('✅ COMMUNE FOUND BY LYON ARRONDISSEMENT', {
                        codeInsee: commune.codeInsee,
                        commune: commune.commune,
                        codePostal: cp,
                    });

                    return commune;
                }
            }
        }

        // =====================================================
        // 6. SÉCURITÉ
        //
        // Ne surtout pas faire :
        //
        // return communes[0];
        //
        // Si plusieurs communes existent et que nous ne
        // pouvons pas déterminer laquelle est correcte,
        // on retourne null.
        // =====================================================

        console.warn('⚠️ COMMUNE AMBIGUOUS - IMPOSSIBLE TO DETERMINE', {
            city: cleanCity,
            codePostal,
            communes: communes.map((c) => ({
                codeInsee: c.codeInsee,
                commune: c.commune,
                codeDepartement: c.codeDepartement,
            })),
        });

        return null;
    }

    /**
     * Normalisation commune
     *
     * Exemples :
     *
     * SAINT-RAPHAEL
     * → SAINT-RAPHAEL
     *
     * Champs-sur-Marne
     * → CHAMPS-SUR-MARNE
     *
     * Paris 4e
     * → PARIS
     */
    normalizeCity(city: string): string {
        if (!city) {
            return '';
        }

        return city
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/['’]/g, '-')
            .replace(/\b\d+\s*(ER|ERE|EME|E)\b/g, '')
            .replace(/\bARRONDISSEMENT\b/g, '')
            .replace(/[^A-Z0-9\s-]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
}
