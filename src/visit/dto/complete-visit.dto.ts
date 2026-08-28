import { IsOptional, IsString } from 'class-validator';

export class CompleteVisitDto {
    @IsOptional()
    @IsString()
    overallNote?: string;
}