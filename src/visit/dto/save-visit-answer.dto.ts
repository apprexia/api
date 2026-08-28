import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { VisitAnswerStatus, VisitCategory } from '@prisma/client';

export class SaveVisitAnswerDto {
    @IsString()
    questionKey: string;

    @IsEnum(VisitCategory)
    category: VisitCategory;

    @IsEnum(VisitAnswerStatus)
    status: VisitAnswerStatus;

    @IsOptional()
    @IsString()
    note?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    estimatedCost?: number;
}
