import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { UpdateAnalysisDto } from './dto/update-analysis.dto';
import { PrismaService } from '../services/prisma/prisma.service';
import { AnalysesAiService } from '../services/analyses-ai/analyses-ai.service';
import { AnalysisAiResult } from './interfaces/analysis-ai-result.interface';
import {
  ListingMetadata,
  MetadataScraperService,
} from '../services/meta-data-scrapper/meta-data-scrapper.service';
import { UsersService } from 'src/users/users.service';
import { CreditsService } from '../credits/credits.service';
import { DvfService } from '../dvf/dvf.service';

@Injectable()
export class AnalysesService {
  constructor(
    private prisma: PrismaService,
    private analysesAiService: AnalysesAiService,
    private metadataScraperService: MetadataScraperService,
    private usersService: UsersService,
    private creditsService: CreditsService,
    private dvfService: DvfService,
  ) {}

  async create(dto: CreateAnalysisDto, userId: string) {
    await this.usersService.consumeCredit(userId);
    const sourceSite = this.getSourceSite(dto.url);

    const analysis = await this.prisma.analysis.create({
      data: {
        userId,

        url: dto.url,
        sourceSite,
        status: 'SCRAPING',
      },
    });

    void this.processAnalysis(analysis.id, dto.url);

    return {
      id: analysis.id,
    };
  }

  private async processAnalysis(analysisId: string, url: string) {
    let aiResult: AnalysisAiResult;

    let metadata: ListingMetadata | null = null;

    let marketData: {
      count: number;
      averagePriceM2: number;
      estimatedValue: number;
    } | null = null;

    try {
      // -------------------------
      // ÉTAPE 1 : SCRAPING
      // -------------------------

      await this.prisma.analysis.update({
        where: {
          id: analysisId,
        },
        data: {
          status: 'SCRAPING',
        },
      });

      metadata = await this.metadataScraperService.scrape(url);

      console.log('SCRAPER RESULT');
      console.log(metadata);

      // -------------------------
      // ÉTAPE 2 : DONNÉES DVF
      // -------------------------

      if (
        metadata.commune &&
        metadata.typeLocal &&
        metadata.surface &&
        metadata.surface > 0
      ) {
        marketData = await this.dvfService.getMarketData(
          metadata.commune,
          metadata.typeLocal,
          metadata.surface,
        );
      }

      console.log('DVF RESULT');
      console.log(marketData);

      // -------------------------
      // ÉTAPE 3 : VALIDATION MINIMALE
      // -------------------------
      //
      // On ne bloque plus sur commune/surface/type
      // car le scraper peut être incomplet.
      //
      // On bloque uniquement si aucune info exploitable.
      //

      const validation = this.validateMetadata(metadata);

      if (!validation.valid) {
        await this.prisma.analysis.update({
          where: {
            id: analysisId,
          },

          data: {
            status: 'INSUFFICIENT_DATA',

            title: metadata.title ?? '',

            imageUrl: metadata.images?.[0] ?? '',

            askingPrice: metadata.price ?? 0,

            description: metadata.description ?? '',

            risks: [
              `Informations manquantes : ${validation.missing.join(', ')}`,
            ],
          },
        });

        await this.refundAnalysisCredit(analysisId);

        return;
      }

      // -------------------------
      // ÉTAPE 4 : SCRAPED
      // -------------------------

      await this.prisma.analysis.update({
        where: {
          id: analysisId,
        },

        data: {
          status: 'SCRAPED',

          title: metadata.title ?? '',

          imageUrl: metadata.images?.[0] ?? '',

          askingPrice: metadata.price ?? 0,

          description: metadata.description ?? '',
        },
      });

      // -------------------------
      // ÉTAPE 5 : IA
      // -------------------------

      await this.prisma.analysis.update({
        where: {
          id: analysisId,
        },

        data: {
          status: 'AI_PROCESSING',
        },
      });

      aiResult = await this.analysesAiService.analyze(metadata, marketData);
    } catch (error) {
      console.error('Erreur analyse :', error);

      aiResult = {
        title: metadata?.title ?? 'Analyse indisponible',

        city: metadata?.commune ?? 'N/A',

        rooms: 0,

        surface: metadata?.surface ?? 0,

        score: 0,

        scoreExplanation: 'Analyse IA indisponible.',

        verdict: 'ERROR',

        verdictExplanation: 'Impossible de générer une analyse IA.',

        estimatedValue: 0,

        askingPrice: metadata?.price ?? 0,

        recommendedPrice: 0,

        negotiationAmount: 0,

        negotiationAnalysis: '',

        description: metadata?.description ?? '',

        marketPosition: '',

        grossYield: 0,

        yieldLevel: 'INCONNU',

        yieldAnalysis: 'Rentabilité non calculée.',

        riskLevel: 0,

        negotiationPotential: 0,

        imageUrl: metadata?.images?.[0] ?? 'images/placeholder.png',

        strengths: [],

        risks: ['Analyse IA indisponible'],
      };
    }

    // -------------------------
    // ÉTAPE 6 : STATUS FINAL
    // -------------------------

    const finalStatus =
      aiResult.verdict === 'ERROR' ? 'AI_FAILED' : 'COMPLETED';

    if (finalStatus === 'AI_FAILED') {
      await this.refundAnalysisCredit(analysisId);
    }

    // -------------------------
    // ÉTAPE 7 : SAUVEGARDE
    // -------------------------

    await this.prisma.analysis.update({
      where: {
        id: analysisId,
      },

      data: {
        status: finalStatus,

        title: aiResult.title,

        city: aiResult.city,

        rooms: aiResult.rooms,

        surface: aiResult.surface,

        score: aiResult.score,

        scoreExplanation: aiResult.scoreExplanation,

        verdict: aiResult.verdict,

        verdictExplanation: aiResult.verdictExplanation,

        estimatedValue: marketData?.estimatedValue ?? aiResult.estimatedValue,

        askingPrice: metadata?.price ?? aiResult.askingPrice ?? 0,

        recommendedPrice: aiResult.recommendedPrice,

        negotiationAmount: aiResult.negotiationAmount,

        negotiationPotential: aiResult.negotiationPotential,

        negotiationAnalysis: aiResult.negotiationAnalysis,

        description: aiResult.description,

        imageUrl: aiResult.imageUrl,

        marketPosition: aiResult.marketPosition,

        riskLevel: aiResult.riskLevel,

        grossYield: aiResult.grossYield,

        yieldLevel: aiResult.yieldLevel,

        yieldAnalysis: aiResult.yieldAnalysis,

        strengths: aiResult.strengths,

        risks: aiResult.risks,
      },
    });

    console.log('FINAL RESULT');
    console.log(aiResult);
  }

  private async refundAnalysisCredit(analysisId: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: {
        id: analysisId,
      },
    });

    if (!analysis) {
      return;
    }

    await this.creditsService.refundCredit(analysis.userId, analysis.id);
  }

  getStatus(id: string) {
    return this.prisma.analysis.findUnique({
      where: { id },

      select: {
        id: true,
        status: true,
      },
    });
  }

  async findAll(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.analysis.findMany({
        where: {
          userId,
        },

        skip,
        take: limit,

        orderBy: {
          createdAt: 'desc',
        },
      }),

      this.prisma.analysis.count({
        where: {
          userId,
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  findOne(id: string, userId: string) {
    return this.prisma.analysis.findFirst({
      where: {
        id,
        userId,
      },

      include: {
        user: true,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateAnalysisDto) {
    const analysis = await this.prisma.analysis.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!analysis) {
      throw new NotFoundException('Analyse introuvable');
    }

    return this.prisma.analysis.update({
      where: {
        id,
      },

      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    const analysis = await this.prisma.analysis.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!analysis) {
      throw new NotFoundException('Analyse introuvable');
    }

    return this.prisma.analysis.delete({
      where: {
        id,
      },
    });
  }

  private getSourceSite(url: string): string {
    const hostname = new URL(url).hostname.replace('www.', '');

    const sources: Record<string, string> = {
      'pap.fr': 'pap',
      'leboncoin.fr': 'leboncoin',
      'seloger.com': 'seloger',
      'bienici.com': 'bienici',
      'logic-immo.com': 'logicimmo',
      'orpi.com': 'orpi',
      'century21.fr': 'century21',
      'paruvendu.fr': 'paruvendu',
    };

    return sources[hostname] ?? hostname;
  }

  private validateMetadata(metadata: ListingMetadata) {
    const missing: string[] = [];

    if (!metadata.price) {
      missing.push('prix');
    }

    if (!metadata.surface) {
      missing.push('surface');
    }

    if (!metadata.commune) {
      missing.push('commune');
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}
