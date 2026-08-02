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
   * Recherche contexte local depuis une commune officielle
   * provenant de DVF
   */
  async findByLocation(city?: string) {
    if (!city) {
      return null;
    }

    const cleanCity = city
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // recherche directe
    const exact = await this.prisma.communeIndicator.findFirst({
      where: {
        commune: {
          equals: cleanCity,
          mode: 'insensitive',
        },
      },
    });

    if (exact) {
      return exact;
    }

    // fallback pour tirets / espaces
    const normalizedForSearch = cleanCity.replace(/[-\s]/g, '');

    const communes = await this.prisma.communeIndicator.findMany({
      where: {
        commune: {
          contains: cleanCity.split(' ')[0],
          mode: 'insensitive',
        },
      },
    });

    return (
      communes.find(
        (c) =>
          c.commune
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[-\s]/g, '') === normalizedForSearch,
      ) ?? null
    );
  }

  /**
   * Normalisation commune
   *
   * Exemple :
   * SAINT-RAPHAEL -> SAINT RAPHAEL
   * Champs-sur-Marne -> CHAMPS SUR MARNE
   * Paris 4e -> PARIS
   */
  normalizeCity(city: string) {
    return (
      city
        .toUpperCase()

        // suppression accents
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

        // tirets
        .replace(/[-_]/g, ' ')

        // arrondissements Paris
        .replace(/\b\d{1,2}(ER|E)\b/g, '')

        // quartiers qui polluent parfois les noms
        .replace(/\b(CENTRE VILLE|CENTRE|PLAGE|GARE|PORT)\b/g, '')

        // espaces multiples
        .replace(/\s+/g, ' ')

        .trim()
    );
  }
}
