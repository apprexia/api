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
     */
    async findByLocation(city?: string, codePostal?: string) {
        console.log('COMMUNE LOOKUP', {
            city,
            codePostal,
        });
        if (!city) {
            return null;
        }

        const cleanCity = this.normalizeCity(city);

        const communes = await this.prisma.communeIndicator.findMany({
            where: {
                commune: cleanCity,
            },
        });

        // Une seule commune trouvée
        if (communes.length === 1) {
            return communes[0];
        }

        // Plusieurs communes (Marseille, Lyon, Paris...)
        if (codePostal) {
            const cp = Number(codePostal);

            return (
                communes.find((c) => {
                    const insee = Number(c.codeInsee);

                    // Paris
                    if (cp >= 75001 && cp <= 75020) {
                        return insee === 75100 + (cp - 75000);
                    }

                    // Marseille
                    if (cp >= 13001 && cp <= 13016) {
                        return insee === 13200 + (cp - 13000);
                    }

                    // Lyon
                    if (cp >= 69001 && cp <= 69009) {
                        return insee === 69380 + (cp - 69000);
                    }

                    return false;
                }) ?? communes[0]
            );
        }

        return communes[0];
    }

    /**
     * Normalisation commune
     *
     * Exemples :
     * SAINT-RAPHAEL -> SAINT-RAPHAEL
     * Champs-sur-Marne -> CHAMPS-SUR-MARNE
     * Paris 4e -> PARIS
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
