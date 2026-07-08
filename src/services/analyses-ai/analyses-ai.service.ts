import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { AnalysisAiResult } from '../../analyses/interfaces/analysis-ai-result.interface';
import { ListingMetadata } from '../meta-data-scrapper/meta-data-scrapper.service';
import { DvfMarketData } from '../../analyses/interfaces/dvf-market-data.interface';
import { ApprexiaMarketData } from '../../analyses/interfaces/apprexia-market-data.interface';

@Injectable()
export class AnalysesAiService {
  constructor(private readonly openaiService: OpenaiService) {}

  async analyze(
    metadata: ListingMetadata,
    marketData?: DvfMarketData | null,
    apprexiaMarketData?: ApprexiaMarketData | null,
  ): Promise<AnalysisAiResult> {
    const result = await this.openaiService.analyze(
      metadata,
      marketData,
      apprexiaMarketData,
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
