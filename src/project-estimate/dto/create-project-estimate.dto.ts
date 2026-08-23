import { IsInt, IsPositive, Min } from 'class-validator';

export class CreateProjectEstimateDto {
    @IsInt()
    @IsPositive()
    monthlyIncome: number;

    @IsInt()
    @Min(0)
    monthlyCredits: number;

    @IsInt()
    @Min(0)
    downPayment: number;

    @IsInt()
    @Min(1)
    householdSize: number;

    @IsInt()
    @IsPositive()
    loanDuration: number;

    @IsInt()
    @Min(0)
    borrowingCapacity: number;

    @IsInt()
    @Min(0)
    monthlyPayment: number;

    @IsInt()
    @Min(0)
    minBudget: number;

    @IsInt()
    @Min(0)
    maxBudget: number;

    @IsInt()
    @Min(0)
    targetBudget: number;
}
