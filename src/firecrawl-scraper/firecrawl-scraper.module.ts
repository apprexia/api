import { Module } from '@nestjs/common';
import { FirecrawlScraperService } from './firecrawl-scraper.service';
import { FirecrawlScraperController } from './firecrawl-scraper.controller';

@Module({
    providers: [FirecrawlScraperService],
    exports: [FirecrawlScraperService],
    controllers: [FirecrawlScraperController],
})
export class FirecrawlScraperModule {}
