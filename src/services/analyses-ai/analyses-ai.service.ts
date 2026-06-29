import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { AnalysisAiResult } from '../../analyses/interfaces/analysis-ai-result.interface';
import { ListingMetadata } from '../meta-data-scrapper/meta-data-scrapper.service';

@Injectable()
export class AnalysesAiService {
  constructor(private readonly openaiService: OpenaiService) {}

  async analyze(metadata: ListingMetadata): Promise<AnalysisAiResult> {
    const result = await this.openaiService.analyze(metadata);

    console.log('OPENAI RESPONSE');
    console.log(result);

    const cleaned = result
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleaned) as AnalysisAiResult;
  }
}
