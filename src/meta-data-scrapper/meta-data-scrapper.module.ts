import { Module } from '@nestjs/common';
import { MetadataScraperService } from './meta-data-scrapper.service';
import { OpenaiService } from '../services/openai/openai.service';
import { HttpModule } from '@nestjs/axios';

@Module({
    imports: [HttpModule],
    providers: [MetadataScraperService, OpenaiService],
    exports: [MetadataScraperService],
    controllers: [],
})
export class MetaDataScrapperModule {}
