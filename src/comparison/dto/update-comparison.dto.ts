import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { ComparisonObjectiveDto } from './create-comparison.dto';

export class UpdateComparisonDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsEnum(ComparisonObjectiveDto)
    objective?: ComparisonObjectiveDto;
}
