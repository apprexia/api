import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { CreateManualAnalysisDto } from './dto/create-manual-analysis.dto';
import { AnalysisMarketService } from 'src/analysis-market/analysis-market.service';
import { ApprexiaMarketData } from './interfaces/apprexia-market-data.interface';
import { AnalysisStatus, Prisma } from '@prisma/client';
import { DvfMarketData } from './interfaces/dvf-market-data.interface';
import { ApprexiaEngineService } from '../apprexia-engine/apprexia-engine.service';
import { RentalEngineService } from '../apprexia-engine/engines/rental-engine/rental-engine.service';
import { RentalResult } from './interfaces/rental-result.interface';
import { LocationProviderService } from '../apprexia-engine/providers/location-provider/location-provider.service';
import { LocationEngineService } from '../apprexia-engine/engines/location-engine/location-engine.service';
import {
  LocationAnalysis,
  LocationEngineInput,
} from '../apprexia-engine/interfaces/location-analysis.interface';
import { GeocodingProviderService } from '../apprexia-engine/providers/geocoding-provider/geocoding-provider.service';
import { AmenityEngineService } from '../apprexia-engine/engines/amenity-engine/amenity-engine.service';
import { CommuneIndicatorService } from '../commune-indicator/commune-indicator.service';
import { CommuneIndicator } from '@prisma/client';

@Injectable()
export class AnalysesService {
  private readonly logger = new Logger(AnalysesService.name);

  constructor(
    private prisma: PrismaService,
    private analysesAiService: AnalysesAiService,
    private metadataScraperService: MetadataScraperService,
    private usersService: UsersService,
    private creditsService: CreditsService,
    private dvfService: DvfService,
    private analysisMarketService: AnalysisMarketService,
    private apprexiaEngineService: ApprexiaEngineService,
    private rentalEngineService: RentalEngineService,
    private readonly locationProvider: LocationProviderService,
    private readonly locationEngine: LocationEngineService,
    private readonly geocodingProvider: GeocodingProviderService,
    private readonly amenityEngine: AmenityEngineService,
    private readonly communeIndicatorService: CommuneIndicatorService,
  ) {}

  async createExtension(url: string, userId: string) {
    return this.create(
      {
        url,
      },
      userId,
    );
  }

  async create(dto: CreateAnalysisDto, userId: string) {
    await this.usersService.consumeCredit(userId);

    const sourceSite = this.getSourceSite(dto.url);

    const analysis = await this.prisma.analysis.create({
      data: {
        userId,
        url: dto.url,
        sourceSite,
        status: AnalysisStatus.SCRAPING,
      },
    });

    try {
      const metadata = await this.metadataScraperService.scrape(dto.url);
      void this.processAnalysis(analysis.id, metadata);
    } catch (error) {
      console.error(error);

      await this.prisma.analysis.update({
        where: { id: analysis.id },
        data: {
          status: 'SCRAPING_FAILED',
        },
      });

      await this.refundAnalysisCredit(analysis.id);
    }

    return {
      id: analysis.id,
    };
  }

  private async processAnalysis(analysisId: string, metadata: ListingMetadata) {
    const defaultImg = 'images/placeholder.png';
    let aiResult: AnalysisAiResult;
    let rentalData: RentalResult | null = null;
    let marketData: DvfMarketData | null = null;
    let locationData: LocationEngineInput | null = null;
    let locationAnalysis: LocationAnalysis | null = null;
    let communeIndicator: CommuneIndicator | null = null;

    try {
      // -------------------------
      // ÉTAPE 1 : DÉMARRAGE
      // -------------------------

      await this.prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: AnalysisStatus.SCRAPING,
        },
      });

      // -------------------------
      // ÉTAPE 2 : TYPE DE BIEN
      // -------------------------

      if (
        metadata.typeLocal !== 'Maison' &&
        metadata.typeLocal !== 'Appartement'
      ) {
        await this.prisma.analysis.update({
          where: { id: analysisId },
          data: {
            status: AnalysisStatus.UNSUPPORTED_PROPERTY_TYPE,
            title: metadata.title ?? '',
            city: this.normalizeCity(metadata.city),
            codePostal: this.normalizeCodePostal(metadata.codePostal),
            imageUrl: metadata.images?.[0] || defaultImg,
            askingPrice: metadata.price ?? 0,
            description: metadata.description ?? '',
            typeLocal: metadata.typeLocal,
            risks: [
              'Apprexia analyse actuellement uniquement les maisons et les appartements.',
            ],
          },
        });

        await this.refundAnalysisCredit(analysisId);
        return;
      }

      // -------------------------
      // ÉTAPE 2.0 : DONNÉES DVF + APPREXIA
      // -------------------------

      let apprexiaMarketData: ApprexiaMarketData | null = null;

      if (
        metadata.city &&
        metadata.typeLocal &&
        metadata.surface &&
        metadata.surface > 0
      ) {
        const dvfParams = {
          city: metadata.city,
          codePostal: metadata.codePostal,
          typeLocal: metadata.typeLocal,
          surface: metadata.surface,
        };

        marketData = await this.dvfService.getMarketData(dvfParams);

        apprexiaMarketData =
          await this.analysisMarketService.getSimilarAnalyses({
            city: metadata.city,
            codePostal: metadata.codePostal,
            typeLocal: metadata.typeLocal,
            surface: metadata.surface,
            terrain: metadata.terrain ?? 0,
          });
      }

      // -------------------------
      // ÉTAPE 2.0 BIS : CONTEXTE COMMUNE
      // -------------------------

      if (metadata.codePostal) {
        const city = await this.dvfService.findCityByPostalCode(
          metadata.codePostal,
        );

        console.log('🏙️ CITY FROM DVF:', city);

        if (city) {
          communeIndicator =
            await this.communeIndicatorService.findByLocation(city);
        }
      }

      console.log('COMMUNE INDICATOR RESULT');
      console.log(communeIndicator);

      // -------------------------
      // ÉTAPE 2.1 : RENTABILITE LOCATIVE
      // -------------------------
      rentalData = await this.rentalEngineService.compute({
        metadata,

        analysis: {
          city: metadata.city,
          typeLocal: metadata.typeLocal,
          rooms: metadata.rooms,
          surface: metadata.surface,
          askingPrice: metadata.price,
        },

        dvf: marketData,
      });

      // -------------------------
      // ÉTAPE 2.2 : LOCATION ENGINE
      // -------------------------

      let latitude = metadata.latitude;
      let longitude = metadata.longitude;

      if (!latitude || !longitude) {
        try {
          const coordinates = await this.geocodingProvider.getCoordinates({
            address: metadata.streetAddress ?? metadata.address ?? '',
            city: metadata.city,
            codePostal: metadata.codePostal,
          });

          if (coordinates) {
            latitude = coordinates.latitude;
            longitude = coordinates.longitude;
          }
        } catch (error) {
          console.warn(
            '⚠️ Impossible de récupérer les coordonnées GPS',
            error.message,
          );
        }
      }

      if (latitude && longitude) {
        try {
          locationData = await this.locationProvider.getLocationData(
            latitude,
            longitude,
          );

          locationAnalysis = this.locationEngine.compute(locationData);
        } catch (error) {
          this.logger.warn(
            `Impossible de récupérer les données de localisation : ${
              error instanceof Error ? error.message : error
            }`,
          );

          locationData = null;
          locationAnalysis = null;
        }
      }

      console.log('LOCATION RESULT');
      console.log(locationAnalysis);

      // -------------------------
      // ÉTAPE 3 : VALIDATION
      // -------------------------

      const validation = this.validateMetadata(metadata);
      if (!validation.valid) {
        await this.prisma.analysis.update({
          where: { id: analysisId },

          data: {
            status: AnalysisStatus.INSUFFICIENT_DATA,
            title: metadata.title ?? '',
            city: this.normalizeCity(metadata.city),
            codePostal: this.normalizeCodePostal(metadata.codePostal),
            imageUrl: metadata.images?.[0] || defaultImg,
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
        where: { id: analysisId },

        data: {
          status: AnalysisStatus.SCRAPED,
          title: metadata.title ?? '',
          city: this.normalizeCity(metadata.city),
          codePostal: this.normalizeCodePostal(metadata.codePostal),
          imageUrl: metadata.images?.[0] || defaultImg,
          askingPrice: metadata.price ?? 0,
          description: metadata.description ?? '',
        },
      });

      // -------------------------
      // ÉTAPE 5 : IA
      // -------------------------

      await this.prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: AnalysisStatus.AI_PROCESSING,
        },
      });

      aiResult = await this.analysesAiService.analyze(
        metadata,
        marketData,
        apprexiaMarketData,
        rentalData,
        locationAnalysis,
        communeIndicator,
      );

      // =========================
      // AMENITIES ENGINE
      // =========================

      const amenityAnalysis = this.amenityEngine.compute(
        metadata.propertyFeatures,
        metadata.surface,
      );

      aiResult.propertyFeatures = metadata.propertyFeatures;

      aiResult = await this.apprexiaEngineService.evaluate({
        metadata,
        analysis: aiResult,
        dvf: marketData,
        apprexia: apprexiaMarketData,
        commune: communeIndicator,
        date: new Date(),
      });

      aiResult.amenities = amenityAnalysis;

      // -------------------------
      // ÉTAPE 5B : RÈGLES MÉTIER
      // -------------------------
    } catch (error) {
      console.error('Erreur analyse :', error);

      aiResult = {
        title: metadata.title ?? 'Analyse indisponible',
        city: metadata.city ?? 'N/A',
        rooms: metadata.rooms ?? 0,
        surface: metadata.surface ?? 0,

        score: 0,
        scoreExplanation: 'Analyse IA indisponible.',

        verdict: 'ERREUR',
        verdictExplanation: 'Impossible de générer une analyse IA.',

        estimatedValueLow: 0,
        estimatedValueHigh: 0,
        dvfReferenceValue: 0,

        askingPrice: metadata.price ?? 0,
        recommendedPrice: 0,

        negotiationAmount: 0,
        negotiationAnalysis: '',
        negotiationPotential: 0,

        description: metadata.description ?? '',

        marketPosition: 'PRIX MARCHE',

        // 🏠 Rental Market
        estimatedRentMonthly: null,
        estimatedRentLow: null,
        estimatedRentHigh: null,
        rentPerSquareMeter: null,
        rentConfidence: null,

        grossYield: null,
        yieldLevel: 'INCONNU',
        yieldAnalysis: 'Rentabilité non calculée.',

        riskLevel: 0,

        imageUrl: metadata.images?.[0] || defaultImg,

        strengths: [],
        risks: ['Analyse IA indisponible'],
      };
    }

    // -------------------------
    // ÉTAPE 6 : STATUS FINAL
    // -------------------------

    const finalStatus =
      aiResult.verdict === 'ERREUR'
        ? AnalysisStatus.AI_FAILED
        : AnalysisStatus.COMPLETED;

    if (finalStatus === AnalysisStatus.AI_FAILED) {
      await this.refundAnalysisCredit(analysisId);
    }

    // -------------------------
    // ÉTAPE 7 : SAUVEGARDE
    // -------------------------
    console.log(
      'NORMALIZE CITY',
      this.normalizeCity(metadata.city ?? aiResult.city),
    );
    await this.prisma.analysis.update({
      where: { id: analysisId },

      data: {
        status: finalStatus,
        title: aiResult.title,
        city: this.normalizeCity(metadata.city ?? aiResult.city),
        codePostal: this.normalizeCodePostal(metadata.codePostal),
        typeLocal: metadata.typeLocal,
        rooms: aiResult.rooms,
        surface: aiResult.surface,
        terrain: metadata.terrain,
        score: aiResult.score,
        scoreExplanation: aiResult.scoreExplanation,
        verdict: aiResult.verdict,
        verdictExplanation: aiResult.verdictExplanation,
        estimatedValueLow: aiResult.estimatedValueLow,
        estimatedValueHigh: aiResult.estimatedValueHigh,
        dvfReferenceValue: marketData?.dvfReferenceValue ?? 0,
        askingPrice: metadata.price ?? aiResult.askingPrice ?? 0,
        recommendedPrice: aiResult.recommendedPrice,
        negotiationAmount: aiResult.negotiationAmount,
        negotiationPotential: aiResult.negotiationPotential,
        negotiationAnalysis: aiResult.negotiationAnalysis,
        location: locationAnalysis
          ? (locationAnalysis as unknown as Prisma.InputJsonValue)
          : undefined,
        amenities: aiResult.amenities
          ? (aiResult.amenities as unknown as Prisma.InputJsonValue)
          : undefined,
        description: aiResult.description,
        imageUrl: aiResult.imageUrl || defaultImg,
        marketPosition: aiResult.marketPosition,
        riskLevel: aiResult.riskLevel,
        communeIndicatorCodeInsee: communeIndicator?.codeInsee ?? null,
        communeContext: communeIndicator
          ? (communeIndicator as unknown as Prisma.InputJsonValue)
          : undefined,
        communeAnalysis: aiResult.communeAnalysis
          ? (aiResult.communeAnalysis as unknown as Prisma.InputJsonValue)
          : undefined,
        // 🏠 RENTABILITÉ LOCATIVE
        estimatedRentMonthly: aiResult.estimatedRentMonthly,
        estimatedRentLow: aiResult.estimatedRentLow,
        estimatedRentHigh: aiResult.estimatedRentHigh,
        rentPerSquareMeter: aiResult.rentPerSquareMeter,
        rentConfidence: aiResult.rentConfidence,

        grossYield: aiResult.grossYield,
        yieldLevel: aiResult.yieldLevel,
        yieldAnalysis: aiResult.yieldAnalysis,

        engine: aiResult.engine
          ? (aiResult.engine as unknown as Prisma.InputJsonValue)
          : undefined,

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

  async findAll(userId: string, page = 1, limit = 10, status?: AnalysisStatus) {
    const skip = (page - 1) * limit;

    const where: Prisma.AnalysisWhereInput = {
      userId,
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.analysis.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },

        include: {
          communeIndicator: {
            select: {
              population: true,
              priceEvolution5Years: true,
              medianPriceM2: true,
              fiberCoverage: true,
              schoolIndex: true,
              doctorAccess: true,
              propertyTaxRate: true,
              floodRisk: true,
              localScore: true,
            },
          },
        },
      }),

      this.prisma.analysis.count({
        where,
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

        communeIndicator: {
          select: {
            codeInsee: true,
            commune: true,
            region: true,
            population: true,
            evolutionPopulation5Years: true,

            medianPriceM2: true,
            medianApartmentPriceM2: true,
            medianHousePriceM2: true,
            priceEvolution5Years: true,
            dvfTransactions: true,

            dpeAB: true,
            passoiresDpe: true,

            schoolIndex: true,
            fiberCoverage: true,
            doctorAccess: true,

            floodRisk: true,
            icpeSurface: true,
            sevesoSurface: true,

            propertyTaxRate: true,
            propertyTaxM2: true,

            localScore: true,
          },
        },
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

  private mapManualDtoToMetadata(
    dto: CreateManualAnalysisDto,
  ): ListingMetadata {
    return {
      source: 'manual',
      title: `${dto.typeLocal} ${dto.surface}m² - ${dto.ville}`,
      address: dto.adresse,
      city: dto.ville,
      codePostal: dto.codePostal,
      latitude: dto.latitude,
      longitude: dto.longitude,

      typeLocal: dto.typeLocal,
      surface: dto.surface,
      terrain: dto.terrain,
      rooms: dto.pieces,

      floor: dto.etage ?? null,
      condition: dto.etat,
      dpe: dto.dpe,
      propertyFeatures: dto.propertyFeatures,

      price: dto.prix,
      currency: 'EUR',
      images: [],
    };
  }

  private getSourceSite(url: string): string {
    const hostname = new URL(url).hostname.replace('www.', '');

    const sources: Record<string, string> = {
      'pap.fr': 'pap',
      'leboncoin.fr': 'leboncoin',
      'seloger.com': 'seloger',
      'bienici.com': 'bienici',
      'ladresse.com': 'ladresse',
      'logic-immo.com': 'logicimmo',
      'orpi.com': 'orpi',
      'century21.fr': 'century21',
      'paruvendu.fr': 'paruvendu',
      'immobilier.lefigaro.fr': 'figaroimmo',
      'guy-hoquet.com': 'guyhoquet',
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

    if (!metadata.city) {
      missing.push('city');
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  async createManual(dto: CreateManualAnalysisDto, userId: string) {
    await this.usersService.consumeCredit(userId);
    const sourceSite = dto.sourceSite;

    const analysis = await this.prisma.analysis.create({
      data: {
        userId,
        url: 'manual',
        sourceSite: sourceSite,
        status: AnalysisStatus.SCRAPING,
        typeLocal: dto.typeLocal,
      },
    });

    const metadata: ListingMetadata = this.mapManualDtoToMetadata(dto);

    void this.processAnalysis(analysis.id, metadata);

    return {
      id: analysis.id,
    };
  }

  private normalizeCity(city?: string): string | undefined {
    if (!city) {
      return undefined;
    }

    let normalized = city
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    const ignoredWords = [
      'CENTRE',
      'VILLE',
      'QUARTIER',
      'GARE',
      'PLAGE',
      'PORT',
    ];

    normalized = normalized
      .split(' ')
      .filter((word) => !ignoredWords.includes(word))
      .join(' ');

    // remettre les tirets officiels
    normalized = normalized.replace(/\s+/g, '-');

    return normalized;
  }

  private normalizeCodePostal(codePostal?: string | null): string | null {
    if (!codePostal) {
      return null;
    }

    return codePostal.trim();
  }

  private isSupportedPropertyType(metadata: ListingMetadata): boolean {
    return (
      metadata.typeLocal === 'Maison' || metadata.typeLocal === 'Appartement'
    );
  }
}
