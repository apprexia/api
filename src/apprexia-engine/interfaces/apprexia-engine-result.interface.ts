import { AnalysisAiResult } from '../../analyses/interfaces/analysis-ai-result.interface';

export interface ApprexiaEngineResult {
  analysis: AnalysisAiResult;

  confidence: number;

  version: string;

  executionTime: number;
}
