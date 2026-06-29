import { Injectable } from '@nestjs/common';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { UpdateAnalysisDto } from './dto/update-analysis.dto';
import { PrismaService } from '../services/prisma/prisma.service';
import { AnalysesAiService } from '../services/analyses-ai/analyses-ai.service';
import { AnalysisAiResult } from './interfaces/analysis-ai-result.interface';
import {
  ListingMetadata,
  MetadataScraperService,
} from '../services/meta-data-scrapper/meta-data-scrapper.service';

@Injectable()
export class AnalysesService {
  constructor(
    private prisma: PrismaService,
    private analysesAiService: AnalysesAiService,
    private metadataScraperService: MetadataScraperService,
  ) {}

  async create(dto: CreateAnalysisDto) {
    const analysis = await this.prisma.analysis.create({
      data: {
        userId: '838412aa-87f1-4bfa-bccc-6a31d14cb886',

        url: dto.url,

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

      aiResult = await this.analysesAiService.analyze(url);
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

        estimatedValue: 0,

        askingPrice: metadata?.price ?? 0,

        recommendedPrice: 0,
        negotiationAmount: 0,

        description: metadata?.description ?? '',

        marketPosition: '',

        grossYield: 0,
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

        estimatedValue: aiResult.estimatedValue,

        askingPrice: aiResult.askingPrice,

        recommendedPrice: aiResult.recommendedPrice,

        negotiationAmount: aiResult.negotiationAmount,

        description: aiResult.description,

        marketPosition: aiResult.marketPosition,

        grossYield: aiResult.grossYield,

        riskLevel: aiResult.riskLevel,

        negotiationPotential: aiResult.negotiationPotential,

        imageUrl: aiResult.imageUrl,

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

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.analysis.findMany({
        skip,
        take: limit,

        orderBy: {
          createdAt: 'desc',
        },
      }),

      this.prisma.analysis.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  findOne(id: string) {
    return this.prisma.analysis.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });
  }

  update(id: string, dto: UpdateAnalysisDto) {
    return this.prisma.analysis.update({
      where: { id },
      data: dto,
    });
  }

  remove(id: string) {
    return this.prisma.analysis.delete({
      where: { id },
    });
  }
}
