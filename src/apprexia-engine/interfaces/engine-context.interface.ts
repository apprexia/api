import { AnalysisAiResult } from '../../analyses/interfaces/analysis-ai-result.interface';
import { DvfMarketData } from '../../analyses/interfaces/dvf-market-data.interface';
import { ApprexiaMarketData } from '../../analyses/interfaces/apprexia-market-data.interface';
import { ListingMetadata } from '../../services/meta-data-scrapper/meta-data-scrapper.service';
import { CommuneIndicator } from '@prisma/client';

export interface EngineContext {
  metadata: ListingMetadata;
  analysis: AnalysisAiResult;
  dvf: DvfMarketData | null;
  apprexia: ApprexiaMarketData | null;
  commune: CommuneIndicator | null;
  date: Date;
}
