import { Injectable } from '@nestjs/common';
import { PrismaService } from '../services/prisma/prisma.service';
import { AnalysisStatus } from '@prisma/client';

@Injectable()
export class AnalysisMarketService {
  constructor(private prisma: PrismaService) {}

  async getSimilarAnalyses(params: {
    city: string;
    codePostal?: string;
    typeLocal: string;
    surface: number;
  }) {
    const { city, codePostal, typeLocal, surface } = params;

    const normalizedCity = this.normalizeCommune(city, codePostal);

    const normalizedType: 'Appartement' | 'Maison' | undefined = typeLocal
      ?.toLowerCase()
      .includes('appartement')
      ? 'Appartement'
      : typeLocal?.toLowerCase().includes('maison')
        ? 'Maison'
        : undefined;

    const tolerance = Math.max(surface * 0.3, 10);

    const minSurface = Math.max(5, surface - tolerance);
    const maxSurface = surface + tolerance;

    const baseWhere = {
      status: AnalysisStatus.COMPLETED,

      ...(normalizedType && {
        typeLocal: normalizedType,
      }),

      surface: {
        gte: minSurface,
        lte: maxSurface,
      },

      verdict: {
        not: 'ERROR',
      },

      createdAt: {
        gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      },
    };

    let analyses = await this.prisma.analysis.findMany({
      where: {
        ...baseWhere,
        city: normalizedCity,

        ...(codePostal && {
          codePostal,
        }),
      },

      select: {
        surface: true,
        createdAt: true,

        score: true,
        verdict: true,

        askingPrice: true,
        recommendedPrice: true,

        grossYield: true,
        negotiationAmount: true,
      },
    });

    if (!analyses.length) {
      analyses = await this.prisma.analysis.findMany({
        where: {
          ...baseWhere,
          city: normalizedCity,
        },

        select: {
          surface: true,
          createdAt: true,

          score: true,
          verdict: true,

          askingPrice: true,
          recommendedPrice: true,

          grossYield: true,
          negotiationAmount: true,
        },
      });
    }

    if (!analyses.length) {
      return null;
    }

    // -------------------------------------------------
    // On garde les analyses les plus similaires
    // -------------------------------------------------

    analyses.sort((a, b) => {
      const aSurface = a.surface ?? surface;
      const bSurface = b.surface ?? surface;

      const surfaceDiff =
        Math.abs(aSurface - surface) - Math.abs(bSurface - surface);

      if (surfaceDiff !== 0) {
        return surfaceDiff;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const comparables = analyses
      .filter((a): a is typeof a & { surface: number } => a.surface !== null)
      .slice(0, 20);

    // -------------------------------------------------
    // Moyenne pondérée
    // -------------------------------------------------

    const weightedAverage = (
      selector: (item: (typeof comparables)[number]) => number | null,
    ) => {
      let weightedSum = 0;
      let totalWeight = 0;

      for (const item of comparables) {
        const value = selector(item);

        if (value === null || value === undefined || isNaN(value)) {
          continue;
        }

        const surfaceWeight = Math.exp(-Math.abs(item.surface - surface) / 15);

        const ageDays =
          (Date.now() - new Date(item.createdAt).getTime()) /
          (1000 * 60 * 60 * 24);

        const recencyWeight = Math.max(0.5, 1 - ageDays / 365);

        const weight = surfaceWeight * recencyWeight;

        weightedSum += value * weight;
        totalWeight += weight;
      }

      return totalWeight ? weightedSum / totalWeight : 0;
    };

    const averageAskingPrice = weightedAverage((a) => a.askingPrice);

    const averageRecommendedPrice = weightedAverage((a) => a.recommendedPrice);

    const averageNegotiation = weightedAverage((a) => a.negotiationAmount);

    const averageYield = weightedAverage((a) => a.grossYield);

    const averageScore = weightedAverage((a) => a.score);

    const averageDiscountPercent =
      averageAskingPrice > 0
        ? ((averageAskingPrice - averageRecommendedPrice) /
            averageAskingPrice) *
          100
        : 0;

    const averageSurfaceDifference = comparables.length
      ? comparables.reduce((sum, a) => sum + Math.abs(a.surface - surface), 0) /
        comparables.length
      : 0;

    let confidence = 40;

    confidence += Math.min(30, comparables.length * 2);

    if (averageSurfaceDifference < 5) {
      confidence += 15;
    }

    if (codePostal) {
      confidence += 10;
    }

    confidence = Math.min(95, Math.round(confidence));

    const strongComparablesCount = comparables.filter(
      (a) => Math.abs(a.surface - surface) <= 10,
    ).length;

    const comparisonSummary = `
${comparables.length} biens similaires analysés.

Surface moyenne comparable :
écart moyen ${averageSurfaceDifference.toFixed(1)} m².

Prix affichés moyens :
${Math.round(averageAskingPrice)} €.

Prix recommandés moyens :
${Math.round(averageRecommendedPrice)} €.

Réduction moyenne observée :
${averageDiscountPercent.toFixed(1)}%.

Niveau de confiance :
${confidence}%.
`;

    return {
      count: comparables.length,

      confidence,

      comparisonSummary,

      averageSurfaceDifference: Number(averageSurfaceDifference.toFixed(1)),

      strongComparablesCount,

      averageScore: Math.round(averageScore),

      averageYield: Number(averageYield.toFixed(1)),

      averageNegotiation: Math.round(averageNegotiation),

      averageRecommendedPrice: Math.round(averageRecommendedPrice),

      averageAskingPrice: Math.round(averageAskingPrice),

      averageDiscountPercent: Number(averageDiscountPercent.toFixed(1)),

      investir: comparables.filter((a) => a.verdict === 'INVESTIR').length,

      negocier: comparables.filter((a) => a.verdict === 'NEGOCIER').length,

      eviter: comparables.filter((a) => a.verdict === 'EVITER').length,
    };
  }

  private normalizeCommune(city: string, codePostal?: string): string {
    if (!city) return '';

    let normalizedCity = city
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // ----------------------------
    // 1. SUPPRESSION ARRONDISSEMENTS
    // ----------------------------
    normalizedCity = normalizedCity
      .replace(/\b\d{1,2}(E|ER)?\b/g, '') // 4E, 03, etc
      .replace(/ARRONDISSEMENT/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // ----------------------------
    // 2. NORMALISATION GRANDES VILLES
    // ----------------------------
    if (normalizedCity.includes('PARIS')) {
      return 'PARIS';
    }

    if (normalizedCity.includes('LYON')) {
      return 'LYON';
    }

    if (normalizedCity.includes('MARSEILLE')) {
      return 'MARSEILLE';
    }

    // ----------------------------
    // 3. DEFAULT
    // ----------------------------
    return normalizedCity;
  }
}
