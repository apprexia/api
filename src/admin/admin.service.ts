import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { CreditTransactionType } from '@prisma/client';

import { PrismaService } from '../services/prisma/prisma.service';

@Injectable()
export class AdminService {
    constructor(private readonly prisma: PrismaService) {}

    /* =========================================================
       DASHBOARD
    ========================================================= */

    async getDashboard() {
        const [usersCount, analysesCount, completedAnalyses, failedAnalyses, creditsResult] = await Promise.all([
            this.prisma.user.count(),

            this.prisma.analysis.count(),

            this.prisma.analysis.count({
                where: {
                    status: 'COMPLETED',
                },
            }),

            this.prisma.analysis.count({
                where: {
                    status: {
                        in: ['AI_FAILED', 'SCRAPING_FAILED'],
                    },
                },
            }),

            this.prisma.user.aggregate({
                _sum: {
                    credits: true,
                },
            }),
        ]);

        return {
            users: {
                total: usersCount,
            },

            analyses: {
                total: analysesCount,
                completed: completedAnalyses,
                failed: failedAnalyses,
            },

            credits: {
                total: creditsResult._sum.credits ?? 0,
            },
        };
    }

    /* =========================================================
       USERS
    ========================================================= */

    async getUsers() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                credits: true,
                createdAt: true,

                _count: {
                    select: {
                        analyses: true,
                        transactions: true,
                    },
                },
            },

            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    /* =========================================================
       USER DETAIL
    ========================================================= */

    async getUserById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: {
                id,
            },

            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                credits: true,
                createdAt: true,

                analyses: {
                    orderBy: {
                        createdAt: 'desc',
                    },

                    take: 10,

                    select: {
                        id: true,
                        sourceSite: true,
                        title: true,
                        city: true,
                        codePostal: true,
                        typeLocal: true,
                        surface: true,
                        askingPrice: true,
                        score: true,
                        verdict: true,
                        status: true,
                        createdAt: true,
                    },
                },

                transactions: {
                    orderBy: {
                        createdAt: 'desc',
                    },

                    take: 20,

                    select: {
                        id: true,
                        amount: true,
                        type: true,
                        description: true,
                        createdAt: true,
                    },
                },

                _count: {
                    select: {
                        analyses: true,
                        transactions: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('Utilisateur introuvable');
        }

        const [completed, failed, pending] = await Promise.all([
            this.prisma.analysis.count({
                where: {
                    userId: id,
                    status: 'COMPLETED',
                },
            }),

            this.prisma.analysis.count({
                where: {
                    userId: id,
                    status: {
                        in: ['AI_FAILED', 'SCRAPING_FAILED'],
                    },
                },
            }),

            this.prisma.analysis.count({
                where: {
                    userId: id,
                    status: {
                        in: ['PENDING', 'SCRAPING', 'SCRAPED', 'AI_PROCESSING'],
                    },
                },
            }),
        ]);

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                credits: user.credits,
                createdAt: user.createdAt,
            },

            statistics: {
                analyses: user._count.analyses,
                completed,
                failed,
                pending,
            },

            recentAnalyses: user.analyses,

            creditTransactions: user.transactions,
        };
    }

    /* =========================================================
       ANALYSES
    ========================================================= */

    async getAnalyses(page = 1, limit = 10, search = '') {
        const skip = (page - 1) * limit;

        const term = search.trim();

        const where = term
            ? {
                  OR: [
                      {
                          title: {
                              contains: term,
                              mode: 'insensitive' as const,
                          },
                      },

                      {
                          city: {
                              contains: term,
                              mode: 'insensitive' as const,
                          },
                      },

                      {
                          codePostal: {
                              contains: term,
                              mode: 'insensitive' as const,
                          },
                      },

                      {
                          typeLocal: {
                              contains: term,
                              mode: 'insensitive' as const,
                          },
                      },

                      {
                          verdict: {
                              contains: term,
                              mode: 'insensitive' as const,
                          },
                      },

                      {
                          status: {
                              contains: term,
                              mode: 'insensitive' as const,
                          },
                      },

                      {
                          user: {
                              OR: [
                                  {
                                      name: {
                                          contains: term,
                                          mode: 'insensitive' as const,
                                      },
                                  },

                                  {
                                      email: {
                                          contains: term,
                                          mode: 'insensitive' as const,
                                      },
                                  },
                              ],
                          },
                      },
                  ],
              }
            : {};

        const [analyses, total] = await Promise.all([
            this.prisma.analysis.findMany({
                where,

                skip,
                take: limit,

                orderBy: {
                    createdAt: 'desc',
                },

                select: {
                    id: true,
                    status: true,
                    sourceSite: true,

                    title: true,
                    city: true,
                    codePostal: true,
                    typeLocal: true,
                    surface: true,
                    askingPrice: true,

                    score: true,
                    verdict: true,
                    createdAt: true,

                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                        },
                    },
                },
            }),

            this.prisma.analysis.count({
                where,
            }),
        ]);

        return {
            data: analyses.map((analysis) => ({
                id: analysis.id,

                user: analysis.user,

                sourceSite: analysis.sourceSite,

                property: {
                    title: analysis.title,
                    typeLocal: analysis.typeLocal,
                    city: analysis.city,
                    codePostal: analysis.codePostal,
                    surface: analysis.surface,
                    askingPrice: analysis.askingPrice,
                },

                score: analysis.score,
                verdict: analysis.verdict,
                status: analysis.status,
                createdAt: analysis.createdAt,
            })),

            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /* =========================================================
       CREDITS OVERVIEW
    ========================================================= */

    async getCreditsOverview() {
        const [users, totalCredits, totalPurchased, totalUsed, totalRefunded, totalAdmin] = await Promise.all([
            this.prisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatar: true,
                    credits: true,
                    createdAt: true,

                    _count: {
                        select: {
                            analyses: true,
                            transactions: true,
                        },
                    },
                },

                orderBy: {
                    createdAt: 'desc',
                },
            }),

            this.prisma.user.aggregate({
                _sum: {
                    credits: true,
                },
            }),

            this.prisma.creditTransaction.aggregate({
                where: {
                    type: CreditTransactionType.PURCHASE,
                },

                _sum: {
                    amount: true,
                },
            }),

            this.prisma.creditTransaction.aggregate({
                where: {
                    type: CreditTransactionType.ANALYSIS,
                },

                _sum: {
                    amount: true,
                },
            }),

            this.prisma.creditTransaction.aggregate({
                where: {
                    type: CreditTransactionType.REFUND,
                },

                _sum: {
                    amount: true,
                },
            }),

            this.prisma.creditTransaction.aggregate({
                where: {
                    type: CreditTransactionType.ADMIN,
                },

                _sum: {
                    amount: true,
                },
            }),
        ]);

        return {
            stats: {
                totalCredits: totalCredits._sum.credits ?? 0,

                totalPurchased: totalPurchased._sum.amount ?? 0,

                totalUsed: Math.abs(totalUsed._sum.amount ?? 0),

                totalRefunded: totalRefunded._sum.amount ?? 0,

                totalAdmin: totalAdmin._sum.amount ?? 0,

                totalUsers: users.length,
            },

            users,
        };
    }

    /* =========================================================
       CREDIT TRANSACTIONS
    ========================================================= */

    async getCreditTransactions(page = 1, limit = 20, search = '') {
        const skip = (page - 1) * limit;

        const term = search.trim();

        const where = term
            ? {
                  user: {
                      OR: [
                          {
                              email: {
                                  contains: term,
                                  mode: 'insensitive' as const,
                              },
                          },

                          {
                              name: {
                                  contains: term,
                                  mode: 'insensitive' as const,
                              },
                          },
                      ],
                  },
              }
            : {};

        const [transactions, total] = await Promise.all([
            this.prisma.creditTransaction.findMany({
                where,

                skip,
                take: limit,

                orderBy: {
                    createdAt: 'desc',
                },

                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            avatar: true,
                        },
                    },
                },
            }),

            this.prisma.creditTransaction.count({
                where,
            }),
        ]);

        return {
            transactions,

            pagination: {
                page,
                limit,
                total,

                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /* =========================================================
       UPDATE USER CREDITS
    ========================================================= */

    async updateUserCredits(userId: string, amount: number, description: string) {
        if (!Number.isInteger(amount)) {
            throw new BadRequestException('Le montant doit être un nombre entier');
        }

        if (amount === 0) {
            throw new BadRequestException('Le montant ne peut pas être égal à zéro');
        }

        if (!description?.trim()) {
            throw new BadRequestException('Une description est obligatoire');
        }

        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: {
                    id: userId,
                },
            });

            if (!user) {
                throw new NotFoundException('Utilisateur introuvable');
            }

            const newCredits = user.credits + amount;

            if (newCredits < 0) {
                throw new BadRequestException('Le nombre de crédits ne peut pas être négatif');
            }

            const updatedUser = await tx.user.update({
                where: {
                    id: userId,
                },

                data: {
                    credits: newCredits,
                },

                select: {
                    id: true,
                    email: true,
                    name: true,
                    credits: true,
                },
            });

            const transaction = await tx.creditTransaction.create({
                data: {
                    userId,

                    amount,

                    type: CreditTransactionType.ADMIN,

                    description: description.trim(),
                },
            });

            return {
                user: updatedUser,

                transaction,
            };
        });
    }
}
