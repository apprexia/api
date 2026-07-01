import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../services/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },

      include: {
        analyses: {
          select: {
            verdict: true,
          },
        },

        favorites: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const analysesCount = user.analyses.length;

    const investir = user.analyses.filter(
      (a) => a.verdict === 'INVESTIR',
    ).length;

    const negocier = user.analyses.filter(
      (a) => a.verdict === 'NEGOCIER',
    ).length;

    const eviter = user.analyses.filter((a) => a.verdict === 'EVITER').length;

    return {
      id: user.id,

      name: user.name,
      email: user.email,
      avatar: user.avatar,

      credits: user.credits,

      stats: {
        analyses: analysesCount,

        favorites: user.favorites.length,

        investir,
        negocier,
        eviter,

        opportunityRate:
          analysesCount === 0
            ? 0
            : Math.round((investir / analysesCount) * 100),
      },
    };
  }

  async seed() {
    return this.prisma.user.create({
      data: {
        email: 'test@apprexia.com',
        name: 'Utilisateur Test',
      },
    });
  }

  async getCredits(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        credits: true,
      },
    });
  }

  async getTransactions(userId: string) {
    return this.prisma.creditTransaction.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async consumeCredit(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        credits: {
          gt: 0,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Crédits insuffisants');
    }

    return this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: userId,
        },

        data: {
          credits: {
            decrement: 1,
          },
        },
      }),

      this.prisma.creditTransaction.create({
        data: {
          userId,

          amount: -1,

          type: 'ANALYSIS',

          description: 'Nouvelle analyse immobilière',
        },
      }),
    ]);
  }

  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
