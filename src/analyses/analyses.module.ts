import { Module } from '@nestjs/common';
import { AnalysesService } from './analyses.service';
import { AnalysesController } from './analyses.controller';
import { AnalysesAiService } from '../services/analyses-ai/analyses-ai.service';
import { OpenaiService } from '../services/openai/openai.service';
import { MetadataScraperService } from '../services/meta-data-scrapper/meta-data-scrapper.service';
import { UsersModule } from '../users/users.module';
import { CreditsModule } from '../credits/credits.module';
import { DvfModule } from '../dvf/dvf.module';
import { AnalysisMarketService } from '../analysis-market/analysis-market.service';

@Module({
  imports: [UsersModule, CreditsModule, DvfModule],
  controllers: [AnalysesController],
  providers: [
    AnalysesService,
    AnalysesAiService,
    OpenaiService,
    MetadataScraperService,
    AnalysisMarketService,
  ],
})
export class AnalysesModule {}
