import { Injectable } from '@nestjs/common';
import { PrismaService } from '../services/prisma/prisma.service';
import { CreateProjectEstimateDto } from './dto/create-project-estimate.dto';

@Injectable()
export class ProjectEstimateService {
    constructor(private readonly prisma: PrismaService) {}

    async saveProjectEstimate(userId: string, dto: CreateProjectEstimateDto) {
        return this.prisma.projectEstimate.upsert({
            where: {
                userId,
            },

            create: {
                userId,

                monthlyIncome: dto.monthlyIncome,
                monthlyCredits: dto.monthlyCredits,
                downPayment: dto.downPayment,
                householdSize: dto.householdSize,
                loanDuration: dto.loanDuration,

                borrowingCapacity: dto.borrowingCapacity,
                monthlyPayment: dto.monthlyPayment,
                minBudget: dto.minBudget,
                maxBudget: dto.maxBudget,
                targetBudget: dto.targetBudget,
            },

            update: {
                monthlyIncome: dto.monthlyIncome,
                monthlyCredits: dto.monthlyCredits,
                downPayment: dto.downPayment,
                householdSize: dto.householdSize,
                loanDuration: dto.loanDuration,

                borrowingCapacity: dto.borrowingCapacity,
                monthlyPayment: dto.monthlyPayment,
                minBudget: dto.minBudget,
                maxBudget: dto.maxBudget,
                targetBudget: dto.targetBudget,
            },
        });
    }

    async getProjectEstimate(userId: string) {
        return this.prisma.projectEstimate.findUnique({
            where: {
                userId,
            },
        });
    }
}
