import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { FirecrawlScraperService } from './firecrawl-scraper.service';

@Controller('firecrawl-scraper')
export class FirecrawlScraperController {
    constructor(private readonly firecrawlScraperService: FirecrawlScraperService) {}

    @Get('test')
    async test(@Query('url') url: string) {
        return this.firecrawlScraperService.scrape(url);
    }

    @Get('markdown')
    async getMarkdown(@Query('url') url: string) {
        if (!url) {
            throw new BadRequestException('URL obligatoire');
        }

        return this.firecrawlScraperService.scrapeMarkdown(url);
    }
}
