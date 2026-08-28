import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../services/prisma/prisma.service';

import { VisitAnswerStatus, VisitStatus, VisitVerdict } from '@prisma/client';

import { CreateVisitDto } from './dto/create-visit.dto';
import { SaveVisitAnswerDto } from './dto/save-visit-answer.dto';
import { CompleteVisitDto } from './dto/complete-visit.dto';

import { VISIT_QUESTIONS } from './visit.questions';

@Injectable()
export class VisitService {
    private readonly totalSteps = 6;

    constructor(private readonly prisma: PrismaService) {}

    // ============================================================
    // CREATE
    // ============================================================

    /**
     * Créer une nouvelle visite à partir d'une analyse.
     */
    async create(dto: CreateVisitDto, userId: string) {
        const analysis = await this.prisma.analysis.findFirst({
            where: {
                id: dto.analysisId,
                userId,
            },

            select: {
                id: true,
            },
        });

        if (!analysis) {
            throw new NotFoundException('Analyse introuvable');
        }

        // --------------------------------------------------------
        // Une seule visite par analyse
        // --------------------------------------------------------

        const existingVisit = await this.prisma.visit.findFirst({
            where: {
                analysisId: dto.analysisId,
                userId,
            },

            orderBy: {
                createdAt: 'desc',
            },
        });

        if (existingVisit) {
            return this.getById(existingVisit.id, userId);
        }

        // --------------------------------------------------------
        // Création
        // --------------------------------------------------------

        return this.prisma.visit.create({
            data: {
                userId,
                analysisId: dto.analysisId,
                status: VisitStatus.IN_PROGRESS,
                currentStep: 1,
            },

            include: {
                analysis: true,
                answers: true,
            },
        });
    }

    // ============================================================
    // GET ONE
    // ============================================================

    /**
     * Récupérer une visite appartenant à l'utilisateur.
     */
    async getById(id: string, userId: string) {
        const visit = await this.prisma.visit.findFirst({
            where: {
                id,
                userId,
            },

            include: {
                analysis: true,

                answers: {
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            },
        });

        if (!visit) {
            throw new NotFoundException('Visite introuvable');
        }

        return visit;
    }

    // ============================================================
    // GET ALL
    // ============================================================

    /**
     * Récupérer toutes les visites de l'utilisateur.
     */
    async findAll(userId: string) {
        return this.prisma.visit.findMany({
            where: {
                userId,
            },

            include: {
                analysis: {
                    select: {
                        id: true,
                        title: true,
                        city: true,
                        askingPrice: true,
                        imageUrl: true,
                        score: true,
                        verdict: true,
                    },
                },
            },

            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // ============================================================
    // SAVE ANSWER
    // ============================================================

    /**
     * Sauvegarder ou modifier une réponse.
     *
     * IMPORTANT :
     *
     * Une visite COMPLETED peut être modifiée
     * depuis /visits/:id/edit.
     *
     * On ne repasse PAS la visite en IN_PROGRESS.
     *
     * Si la visite était déjà terminée, le résultat
     * est recalculé immédiatement.
     */
    async saveAnswer(visitId: string, dto: SaveVisitAnswerDto, userId: string) {
        const visit = await this.prisma.visit.findFirst({
            where: {
                id: visitId,
                userId,
            },
        });

        if (!visit) {
            throw new NotFoundException('Visite introuvable');
        }

        // --------------------------------------------------------
        // Validation de la question
        // --------------------------------------------------------

        const questionExists = VISIT_QUESTIONS.some((question) => question.key === dto.questionKey);

        if (!questionExists) {
            throw new BadRequestException('Question de visite invalide');
        }

        // --------------------------------------------------------
        // UPSERT
        // --------------------------------------------------------

        const answer = await this.prisma.visitAnswer.upsert({
            where: {
                visitId_questionKey: {
                    visitId,
                    questionKey: dto.questionKey,
                },
            },

            create: {
                visitId,
                questionKey: dto.questionKey,
                category: dto.category,
                status: dto.status,
                note: dto.note,
                estimatedCost: dto.estimatedCost,
            },

            update: {
                category: dto.category,
                status: dto.status,
                note: dto.note,
                estimatedCost: dto.estimatedCost,
            },
        });

        // --------------------------------------------------------
        // VISITE TERMINÉE
        // --------------------------------------------------------
        //
        // Si l'utilisateur est en train de modifier
        // une visite terminée, on recalcule immédiatement
        // le résultat.
        //
        // La visite reste COMPLETED.
        // --------------------------------------------------------

        if (visit.status === VisitStatus.COMPLETED) {
            const answers = await this.prisma.visitAnswer.findMany({
                where: {
                    visitId,
                },
            });

            const result = this.calculateResult(answers);

            await this.prisma.visit.update({
                where: {
                    id: visitId,
                },

                data: {
                    score: result.score,

                    verdict: result.verdict,

                    totalEstimatedCosts: result.totalEstimatedCosts,

                    okCount: result.okCount,

                    warningCount: result.warningCount,

                    problemCount: result.problemCount,
                },
            });
        }

        return answer;
    }

    // ============================================================
    // UPDATE STEP
    // ============================================================

    /**
     * Mettre à jour l'étape actuelle.
     *
     * Une visite COMPLETED peut également changer
     * d'étape lorsqu'elle est éditée.
     *
     * Cela ne modifie pas son statut.
     */
    async updateStep(visitId: string, step: number, userId: string) {
        const visit = await this.prisma.visit.findFirst({
            where: {
                id: visitId,
                userId,
            },
        });

        if (!visit) {
            throw new NotFoundException('Visite introuvable');
        }

        // --------------------------------------------------------
        // Validation étape
        // --------------------------------------------------------

        if (!Number.isInteger(step) || step < 1 || step > this.totalSteps) {
            throw new BadRequestException('Étape de visite invalide');
        }

        // --------------------------------------------------------
        // Mise à jour
        // --------------------------------------------------------

        return this.prisma.visit.update({
            where: {
                id: visitId,
            },

            data: {
                currentStep: step,
            },
        });
    }

    // ============================================================
    // COMPLETE
    // ============================================================

    /**
     * Terminer une visite.
     *
     * Seule une visite IN_PROGRESS peut être terminée.
     */
    async complete(visitId: string, dto: CompleteVisitDto, userId: string) {
        const visit = await this.prisma.visit.findFirst({
            where: {
                id: visitId,
                userId,
            },

            include: {
                answers: true,
            },
        });

        if (!visit) {
            throw new NotFoundException('Visite introuvable');
        }

        if (visit.status !== VisitStatus.IN_PROGRESS) {
            throw new BadRequestException('Cette visite est déjà terminée');
        }

        // --------------------------------------------------------
        // Vérification des réponses
        // --------------------------------------------------------

        const questions = VISIT_QUESTIONS;

        const answeredKeys = new Set(visit.answers.map((answer) => answer.questionKey));

        const missingQuestions = questions.filter((question) => !answeredKeys.has(question.key));

        if (missingQuestions.length > 0) {
            throw new BadRequestException('Toutes les questions doivent être complétées avant de terminer la visite.');
        }

        // --------------------------------------------------------
        // Calcul
        // --------------------------------------------------------

        const result = this.calculateResult(visit.answers);

        // --------------------------------------------------------
        // Completion
        // --------------------------------------------------------

        return this.prisma.visit.update({
            where: {
                id: visitId,
            },

            data: {
                status: VisitStatus.COMPLETED,

                completedAt: new Date(),

                currentStep: this.totalSteps,

                score: result.score,

                verdict: result.verdict,

                totalEstimatedCosts: result.totalEstimatedCosts,

                okCount: result.okCount,

                warningCount: result.warningCount,

                problemCount: result.problemCount,

                overallNote: dto.overallNote,
            },

            include: {
                analysis: true,

                answers: true,
            },
        });
    }

    // ============================================================
    // CALCUL DU RÉSULTAT
    // ============================================================

    /**
     * Calcul du score de visite.
     *
     * OK        = 100
     * WARNING   = 50
     * PROBLEM   = 0
     */
    private calculateResult(answers: any[]) {
        let totalPoints = 0;

        let okCount = 0;

        let warningCount = 0;

        let problemCount = 0;

        let totalEstimatedCosts = 0;

        // --------------------------------------------------------
        // Aucune réponse
        // --------------------------------------------------------

        if (!answers || answers.length === 0) {
            return {
                score: 0,

                verdict: VisitVerdict.HIGH_RISK,

                totalEstimatedCosts: 0,

                okCount: 0,

                warningCount: 0,

                problemCount: 0,
            };
        }

        // --------------------------------------------------------
        // Calcul
        // --------------------------------------------------------

        for (const answer of answers) {
            // ----------------------------------------------------
            // Coût
            // ----------------------------------------------------

            if (answer.estimatedCost !== null && answer.estimatedCost !== undefined) {
                totalEstimatedCosts += Number(answer.estimatedCost);
            }

            // ----------------------------------------------------
            // Statut
            // ----------------------------------------------------

            switch (answer.status) {
                case VisitAnswerStatus.OK:
                    okCount++;

                    totalPoints += 100;

                    break;

                case VisitAnswerStatus.WARNING:
                    warningCount++;

                    totalPoints += 50;

                    break;

                case VisitAnswerStatus.PROBLEM:
                    problemCount++;

                    totalPoints += 0;

                    break;
            }
        }

        // --------------------------------------------------------
        // Score
        // --------------------------------------------------------

        const score = Math.round(totalPoints / answers.length);

        // --------------------------------------------------------
        // Verdict
        // --------------------------------------------------------

        let verdict: VisitVerdict;

        if (score >= 85) {
            verdict = VisitVerdict.REASSURING;
        } else if (score >= 70) {
            verdict = VisitVerdict.VIGILANCE;
        } else if (score >= 50) {
            verdict = VisitVerdict.NEGOTIATION;
        } else {
            verdict = VisitVerdict.HIGH_RISK;
        }

        // --------------------------------------------------------
        // Résultat
        // --------------------------------------------------------

        return {
            score,

            verdict,

            totalEstimatedCosts,

            okCount,

            warningCount,

            problemCount,
        };
    }

    // ============================================================
    // QUESTIONS
    // ============================================================

    getQuestions() {
        return VISIT_QUESTIONS;
    }
}
