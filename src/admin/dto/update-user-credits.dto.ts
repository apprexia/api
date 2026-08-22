import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserCreditsDto {
    @IsInt()
    amount: number;

    @IsString()
    @IsNotEmpty()
    description: string;
}
