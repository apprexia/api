import { Module } from '@nestjs/common';
import { FirecrawlScraperService } from './firecrawl-scraper.service';
import { FirecrawlScraperController } from './firecrawl-scraper.controller';
import { OpenaiService } from '../services/openai/openai.service';

@Module({
    providers: [FirecrawlScraperService, OpenaiService],
    exports: [FirecrawlScraperService],
    controllers: [FirecrawlScraperController],
})
export class FirecrawlScraperModule {}
