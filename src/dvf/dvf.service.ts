import { Injectable } from '@nestjs/common';
import { PrismaService } from '../services/prisma/prisma.service';

@Injectable()
export class DvfService {
    constructor(private prisma: PrismaService) {}

    async getMarketData(params: { city: string; codePostal?: string; typeLocal: string; surface: number }) {
        const { city, codePostal, typeLocal, surface } = params;

        const normalizedCommune = this.normalizeCommune(city, codePostal);

        const normalizedType: 'Appartement' | 'Maison' | undefined = typeLocal?.toLowerCase().includes('appartement')
            ? 'Appartement'
            : typeLocal?.toLowerCase().includes('maison')
              ? 'Maison'
              : undefined;

        const tolerance = Math.max(surface * 0.5, 15);

        const minSurface = Math.max(5, surface - tolerance);
        const maxSurface = surface + tolerance;

        let transactions = await this.prisma.dvfTransaction.findMany({
            where: {
                city: normalizedCommune,

                ...(normalizedType && {
                    typeLocal: normalizedType,
                }),

                surface: {
                    gte: minSurface,
                    lte: maxSurface,
                },

                prixM2: {
                    gt: 0,
                },
            },
        });

        // fallback CP
        if (!transactions.length && codePostal) {
            transactions = await this.prisma.dvfTransaction.findMany({
                where: {
                    codePostal,

                    ...(normalizedType && {
                        typeLocal: normalizedType,
                    }),

                    surface: {
                        gte: minSurface,
                        lte: maxSurface,
                    },

                    prixM2: {
                        gt: 0,
                    },
                },
            });
        }

        if (!transactions.length) {
            return {
                count: 0,
                averagePriceM2: 0,
                medianPriceM2: 0,
                adjustedPriceM2: 0,
                dvfReferenceValue: 0,
                lowEstimate: 0,
                highEstimate: 0,
                confidence: 0,
            };
        }

        // -------------------------------------------------
        // On privilégie les surfaces proches
        // -------------------------------------------------

        transactions.sort((a, b) => Math.abs(a.surface - surface) - Math.abs(b.surface - surface));

        const comparables = transactions.slice(0, 25);

        let prices = comparables
            .map((t) => t.prixM2)
            .filter((p) => p > 1000 && p < 20000)
            .sort((a, b) => a - b);

        if (!prices.length) {
            return {
                count: 0,
                averagePriceM2: 0,
                medianPriceM2: 0,
                adjustedPriceM2: 0,
                dvfReferenceValue: 0,
                lowEstimate: 0,
                highEstimate: 0,
                confidence: 0,
            };
        }

        // -------------------------------------------------
        // Suppression automatique des valeurs aberrantes
        // -------------------------------------------------

        const q1 = prices[Math.floor(prices.length * 0.25)];
        const q3 = prices[Math.floor(prices.length * 0.75)];

        const iqr = q3 - q1;

        prices = prices.filter((p) => p >= q1 - iqr * 1.5 && p <= q3 + iqr * 1.5);

        if (!prices.length) {
            return {
                count: 0,
                averagePriceM2: 0,
                medianPriceM2: 0,
                adjustedPriceM2: 0,
                dvfReferenceValue: 0,
                lowEstimate: 0,
                highEstimate: 0,
                confidence: 0,
            };
        }

        // -------------------------------------------------
        // Moyenne pondérée
        // -------------------------------------------------

        let weightedSum = 0;
        let totalWeight = 0;

        for (const transaction of comparables) {
            if (transaction.prixM2 < q1 - iqr * 1.5 || transaction.prixM2 > q3 + iqr * 1.5) {
                continue;
            }

            const weight = 1 / (1 + Math.abs(transaction.surface - surface));

            weightedSum += transaction.prixM2 * weight;
            totalWeight += weight;
        }

        const average = weightedSum / totalWeight;

        // -------------------------------------------------
        // Médiane
        // -------------------------------------------------

        const middle = Math.floor(prices.length / 2);

        const median = prices.length % 2 === 0 ? (prices[middle - 1] + prices[middle]) / 2 : prices[middle];

        // -------------------------------------------------
        // Ajustement petites surfaces
        // -------------------------------------------------

        let coefficient = 1;

        if (surface <= 30 && normalizedType === 'Appartement') {
            coefficient = 1.1;
        }

        const adjustedPriceM2 = median * coefficient;

        const dvfReferenceValue = adjustedPriceM2 * surface;

        // -------------------------------------------------
        // Fourchette basée sur le marché
        // -------------------------------------------------
        const baseValue = adjustedPriceM2 * surface;
        const lowEstimate = baseValue * 0.85;

        const highEstimate = baseValue * 1.25;

        // -------------------------------------------------
        // Confiance
        // -------------------------------------------------

        const dispersion = q3 - q1;

        const confidence = Math.min(
            95,
            Math.round(40 + Math.min(comparables.length, 30) + Math.max(0, 20 - dispersion / 100)),
        );

        return {
            count: prices.length,
            averagePriceM2: Math.round(average),
            medianPriceM2: Math.round(median),
            adjustedPriceM2: Math.round(adjustedPriceM2),
            dvfReferenceValue: Math.round(dvfReferenceValue),
            lowEstimate: Math.round(lowEstimate),
            highEstimate: Math.round(highEstimate),
            confidence,
            q1: Math.round(q1),
            q3: Math.round(q3),
        };
    }

    async findCitiesByPostalCode(codePostal: string): Promise<string[]> {
        const results = await this.prisma.dvfTransaction.findMany({
            where: {
                codePostal,
                city: {
                    not: null,
                },
            },
            select: {
                city: true,
            },
            distinct: ['city'],
        });

        return results.map((r) => r.city).filter((city): city is string => city !== null);
    }

    async findMatchingCity(city?: string, codePostal?: string): Promise<string | null> {
        // Cas 1 : on a la ville
        if (city) {
            const normalizedInput = this.normalizeCity(city);

            // Si CP disponible, on limite la recherche
            if (codePostal) {
                const cities = await this.findCitiesByPostalCode(codePostal);

                const match = cities.find((c) => this.normalizeCity(c) === normalizedInput);

                if (match) {
                    return match;
                }
            }

            // Sinon recherche directe DVF
            const result = await this.prisma.dvfTransaction.findFirst({
                where: {
                    city: normalizedInput,
                },
                select: {
                    city: true,
                },
            });

            if (result) {
                return result.city;
            }
        }

        // Cas 2 : uniquement code postal
        if (codePostal) {
            const cities = await this.findCitiesByPostalCode(codePostal);

            // Une seule commune trouvée
            if (cities.length === 1) {
                return cities[0];
            }

            // Plusieurs communes possibles :
            // impossible de choisir sans autre information
            return null;
        }

        return null;
    }

    private normalizeCity(city: string): string {
        return city
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/-/g, ' ')
            .trim();
    }

    private normalizeCommune(city: string, codePostal?: string): string {
        if (!city) return '';

        let normalizedCity = city
            .trim()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        // Suppression arrondissements
        normalizedCity = normalizedCity
            .replace(/\b\d{1,2}(E|ER)?\b/g, '')
            .replace(/ARRONDISSEMENT/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Grandes villes
        if (normalizedCity.includes('PARIS')) return 'PARIS';
        if (normalizedCity.includes('LYON')) return 'LYON';
        if (normalizedCity.includes('MARSEILLE')) return 'MARSEILLE';

        // Conversion vers le format utilisé dans les DVF
        normalizedCity = normalizedCity
            .replace(/\bSAINTE\b/g, 'STE')
            .replace(/\bSAINT\b/g, 'ST')
            .replace(/\bSOUS\b/g, 'SS')
            .replace(/\s+/g, '-');

        return normalizedCity;
    }
}
