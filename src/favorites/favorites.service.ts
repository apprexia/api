import { Injectable } from '@nestjs/common';
import { PrismaService } from '../services/prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

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

  async findFavoriteAnalyses(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.analysis.findMany({
        where: {
          Favorite: {
            some: {
              userId,
            },
          },
        },

        skip,

        take: limit,
      }),

      this.prisma.analysis.count({
        where: {
          Favorite: {
            some: {
              userId,
            },
          },
        },
      }),
    ]);

    return {
      data,

      totalPages: Math.ceil(total / limit),
    };
  }

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
