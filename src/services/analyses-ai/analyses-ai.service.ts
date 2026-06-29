import { Injectable } from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { AnalysisAiResult } from '../../analyses/interfaces/analysis-ai-result.interface';

@Injectable()
export class AnalysesAiService {
  constructor(private readonly openaiService: OpenaiService) {}

  async analyze(url: string): Promise<AnalysisAiResult> {
    const result = await this.openaiService.analyze(url);

    return JSON.parse(result) as AnalysisAiResult;
  }
}
