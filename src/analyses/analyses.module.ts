import { Module } from '@nestjs/common';
import { AnalysesService } from './analyses.service';
import { AnalysesController } from './analyses.controller';
import { AnalysesAiService } from '../services/analyses-ai/analyses-ai.service';
import { OpenaiService } from '../services/openai/openai.service';
import { MetadataScraperService } from '../meta-data-scrapper/meta-data-scrapper.service';
import { UsersModule } from '../users/users.module';
import { CreditsModule } from '../credits/credits.module';
import { DvfModule } from '../dvf/dvf.module';
import { AnalysisMarketService } from '../analysis-market/analysis-market.service';
import { ApprexiaEngineModule } from '../apprexia-engine/apprexia-engine.module';
import { RentalEngineService } from '../apprexia-engine/engines/rental-engine/rental-engine.service';
import { RentalMarketModule } from '../rental-market/rental-market.module';
import { CommuneIndicatorService } from '../commune-indicator/commune-indicator.service';
import { HttpModule } from '@nestjs/axios';
import { FirecrawlScraperModule } from '../firecrawl-scraper/firecrawl-scraper.module';
import { MetaDataScrapperModule } from '../meta-data-scrapper/meta-data-scrapper.module';

@Module({
    imports: [
        HttpModule,
        UsersModule,
        CreditsModule,
        DvfModule,
        ApprexiaEngineModule,
        RentalMarketModule,
        FirecrawlScraperModule,
        MetaDataScrapperModule,
    ],
    controllers: [AnalysesController],
    providers: [
        AnalysesService,
        AnalysesAiService,
        OpenaiService,
        AnalysisMarketService,
        RentalEngineService,
        CommuneIndicatorService,
    ],
    exports: [AnalysesService],
})
export class AnalysesModule {}
