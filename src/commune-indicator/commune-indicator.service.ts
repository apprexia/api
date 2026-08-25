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
     * Ordre de résolution :
     * 1. Nom normalisé
     * 2. Paris / Marseille / Lyon via code postal
     * 3. Département via code postal
     * 4. Si ambiguïté persistante → null
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

        const cityVariants = this.getCityVariants(cleanCity);

        console.log('🏙️ COMMUNE VARIANTS', cityVariants);

        let communes = await this.prisma.communeIndicator.findMany({
            where: {
                commune: {
                    in: cityVariants,
                },
            },
        });

        console.log('COMMUNE MATCHES', {
            city: cleanCity,
            variants: cityVariants,
            count: communes.length,
            communes: communes.map((c) => ({
                codeInsee: c.codeInsee,
                commune: c.commune,
                codeDepartement: c.codeDepartement,
            })),
        });

        // =====================================================
        // 3. SI AUCUNE COMMUNE → FALLBACK AVEC DÉPARTEMENT
        // =====================================================

        if (communes.length === 0 && codePostal) {
            const cp = codePostal.replace(/\s/g, '');

            let codeDepartement: string | null = null;

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

            if (codeDepartement) {
                console.log('🔎 COMMUNE FALLBACK', {
                    original: cleanCity,
                    variants: cityVariants,
                    codePostal: cp,
                    codeDepartement,
                });

                communes = await this.prisma.communeIndicator.findMany({
                    where: {
                        codeDepartement,
                        commune: {
                            in: cityVariants,
                        },
                    },
                });

                console.log('🔎 COMMUNE FALLBACK RESULT', {
                    count: communes.length,
                    communes: communes.map((c) => ({
                        codeInsee: c.codeInsee,
                        commune: c.commune,
                        codeDepartement: c.codeDepartement,
                    })),
                });
            }
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
        //    → LE CODE POSTAL DEVIENT PRIORITAIRE
        // =====================================================

        if (codePostal) {
            const cp = codePostal.replace(/\s/g, '');
            const cpNumber = Number(cp);

            // ===================================================
            // 5A. PARIS
            // ===================================================

            if (cleanCity === 'PARIS' && cpNumber >= 75001 && cpNumber <= 75020) {
                const arrondissement = cpNumber - 75000;

                const expectedInsee = `751${String(arrondissement).padStart(2, '0')}`;

                const commune = communes.find((c) => c.codeInsee === expectedInsee);

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
            // 5B. MARSEILLE
            // ===================================================

            if (cleanCity === 'MARSEILLE' && cpNumber >= 13001 && cpNumber <= 13016) {
                const arrondissement = cpNumber - 13000;

                const expectedInsee = `132${String(arrondissement).padStart(2, '0')}`;

                const commune = communes.find((c) => c.codeInsee === expectedInsee);

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
            // 5C. LYON
            // ===================================================

            if (cleanCity === 'LYON' && cpNumber >= 69001 && cpNumber <= 69009) {
                const arrondissement = cpNumber - 69000;

                const expectedInsee = `6938${arrondissement}`;

                const commune = communes.find((c) => c.codeInsee === expectedInsee);

                if (commune) {
                    console.log('✅ COMMUNE FOUND BY LYON ARRONDISSEMENT', {
                        codeInsee: commune.codeInsee,
                        commune: commune.commune,
                        codePostal: cp,
                    });

                    return commune;
                }
            }

            // ===================================================
            // 5D. DÉPARTEMENT
            // ===================================================

            let codeDepartement: string | null = null;

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
        }

        // =====================================================
        // 6. SÉCURITÉ
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

    private getCityVariants(city: string): string[] {
        if (!city) {
            return [];
        }

        const variants = new Set<string>();

        const normalized = this.normalizeCity(city);

        variants.add(normalized);

        // LE-PLESSIS-ROBINSON
        // → PLESSIS-ROBINSON
        variants.add(normalized.replace(/^(LE|LA|LES)-/, ''));

        // Variante espaces
        variants.add(normalized.replace(/-/g, ' '));

        // Variante sans article + espaces
        variants.add(normalized.replace(/^(LE|LA|LES)-/, '').replace(/-/g, ' '));

        return [...variants].filter(Boolean);
    }
}
