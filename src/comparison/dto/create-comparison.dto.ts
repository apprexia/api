import {
    ArrayMaxSize,
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export enum ComparisonObjectiveDto {
    GLOBAL = 'GLOBAL',
    PROFITABILITY = 'PROFITABILITY',
    SECURITY = 'SECURITY',
    CAPITAL_GAIN = 'CAPITAL_GAIN',
    NEGOTIATION = 'NEGOTIATION',
    LIQUIDITY = 'LIQUIDITY',
}

export class CreateComparisonDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsEnum(ComparisonObjectiveDto)
    objective?: ComparisonObjectiveDto = ComparisonObjectiveDto.GLOBAL;

    @IsArray()
    @ArrayMinSize(2)
    @ArrayMaxSize(5)
    @ArrayUnique()
    @IsUUID('4', { each: true })
    analysisIds: string[];
}
