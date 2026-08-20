import { AnalysisAiResult } from '../../analyses/interfaces/analysis-ai-result.interface';
import { DvfMarketData } from '../../analyses/interfaces/dvf-market-data.interface';
import { ApprexiaMarketData } from '../../analyses/interfaces/apprexia-market-data.interface';
import { CommuneIndicator } from '@prisma/client';
import { ListingMetadata } from '../../meta-data-scrapper/interfaces/listing-metadata.interface';

export interface EngineContext {
    metadata: ListingMetadata;
    analysis: AnalysisAiResult;
    dvf: DvfMarketData | null;
    apprexia: ApprexiaMarketData | null;
    commune: CommuneIndicator | null;
    date: Date;
}
