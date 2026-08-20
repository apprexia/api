import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { AnalysisAiResult } from '../../analyses/interfaces/analysis-ai-result.interface';
import { DvfMarketData } from '../../analyses/interfaces/dvf-market-data.interface';
import { ApprexiaMarketData } from '../../analyses/interfaces/apprexia-market-data.interface';
import { RentalResult } from '../../analyses/interfaces/rental-result.interface';
import { LocationAnalysis } from '../../apprexia-engine/interfaces/location-analysis.interface';
import { CommuneIndicator } from '@prisma/client';
import { ListingMetadata } from '../../meta-data-scrapper/interfaces/listing-metadata.interface';

@Injectable()
export class AnalysesAiService {
    constructor(private readonly openaiService: OpenaiService) {}

    async analyze(
        metadata: ListingMetadata,
        marketData?: DvfMarketData | null,
        apprexiaMarketData?: ApprexiaMarketData | null,
        rentalData?: RentalResult | null,
        locationAnalysis?: LocationAnalysis | null,
        communeIndicator?: CommuneIndicator | null,
    ): Promise<AnalysisAiResult> {
        const result = await this.openaiService.analyze(
            metadata,
            marketData,
            apprexiaMarketData,
            rentalData,
            locationAnalysis,
            communeIndicator,
        );
        console.log('OPENAI RESPONSE');
        console.log(result);

        const cleaned = result
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();

        return JSON.parse(cleaned) as AnalysisAiResult;
    }
}
