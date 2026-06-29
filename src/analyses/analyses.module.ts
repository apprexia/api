import { Module } from '@nestjs/common';
import { AnalysesService } from './analyses.service';
import { AnalysesController } from './analyses.controller';
import { AnalysesAiService } from '../services/analyses-ai/analyses-ai.service';
import { OpenaiService } from '../services/openai/openai.service';
import { MetadataScraperService } from '../services/meta-data-scrapper/meta-data-scrapper.service';

@Module({
  controllers: [AnalysesController],
  providers: [
    AnalysesService,
    AnalysesAiService,
    OpenaiService,
    MetadataScraperService,
  ],
})
export class AnalysesModule {}
