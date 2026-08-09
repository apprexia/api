import { Injectable } from '@nestjs/common';
import { PrismaService } from '../services/prisma/prisma.service';
import type { Verdict } from '../analyses/interfaces/analysis-ai-result.interface';

@Injectable()
export class FavoritesService {
    constructor(private prisma: PrismaService) {}

    /**
     * Récupérer les IDs des favoris de l'utilisateur.
     */
    findAll(userId: string) {
        return this.prisma.favorite.findMany({
            where: {
                userId,
            },

            select: {
                analysisId: true,
            },
        });
    }

    /**
     * Récupérer les analyses favorites avec pagination
     * et filtre optionnel par verdict.
     */
    async findFavoriteAnalyses(userId: string, page: number, limit: number, verdict?: Verdict) {
        const skip = (page - 1) * limit;

        const where = {
            Favorite: {
                some: {
                    userId,
                },
            },

            ...(verdict && {
                verdict,
            }),
        };

        const [data, total] = await Promise.all([
            this.prisma.analysis.findMany({
                where,
                skip,
                take: limit,

                orderBy: {
                    createdAt: 'desc',
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

    /**
     * Ajouter ou retirer une analyse des favoris.
     */
    async toggle(userId: string, analysisId: string) {
        const favorite = await this.prisma.favorite.findUnique({
            where: {
                userId_analysisId: {
                    userId,
                    analysisId,
                },
            },
        });

        if (favorite) {
            await this.prisma.favorite.delete({
                where: {
                    id: favorite.id,
                },
            });

            return {
                favorite: false,
            };
        }

        await this.prisma.favorite.create({
            data: {
                userId,
                analysisId,
            },
        });

        return {
            favorite: true,
        };
    }

    /**
     * Supprimer un favori.
     */
    remove(userId: string, analysisId: string) {
        return this.prisma.favorite.delete({
            where: {
                userId_analysisId: {
                    userId,
                    analysisId,
                },
            },
        });
    }
}
