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

@Injectable()
export class AnalysesService {
  constructor(
    private prisma: PrismaService,
    private analysesAiService: AnalysesAiService,
    private metadataScraperService: MetadataScraperService,
    private usersService: UsersService,
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

    try {
      // -------------------------
      // ÉTAPE 1 : SCRAPING
      // -------------------------

      await this.prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: 'SCRAPING',
        },
      });

      metadata = await this.metadataScraperService.scrape(url);

      console.log('==============================');
      console.log('SCRAPING RESULT');
      console.log('==============================');
      console.log(metadata);
      console.log('==============================');

      // -------------------------
      // ÉTAPE 2 : SCRAPED
      // -------------------------

      await this.prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: 'SCRAPED',

          title: metadata.title,
          imageUrl: metadata.images?.[0] ?? '',
          askingPrice: metadata.price ?? 0,
          description: metadata.description ?? '',
        },
      });

      // -------------------------
      // ÉTAPE 3 : IA
      // -------------------------

      await this.prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: 'AI_PROCESSING',
        },
      });

      aiResult = await this.analysesAiService.analyze(metadata);
    } catch (error) {
      console.error('Erreur analyse :', error);

      aiResult = {
        title: metadata?.title ?? 'Analyse indisponible',

        city: metadata?.address ?? 'N/A',

        rooms: 0,
        surface: 0,

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
    // ÉTAPE 4 : SAUVEGARDE FINALE
    // -------------------------

    const finalStatus =
      aiResult.verdict === 'ERROR' ? 'AI_FAILED' : 'COMPLETED';

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

        estimatedValue: aiResult.estimatedValue,

        // je recommande plutôt metadata.price ici
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
      'paruvendu.fr': 'paruvendu',
    };

    return sources[hostname] ?? hostname;
  }
}
