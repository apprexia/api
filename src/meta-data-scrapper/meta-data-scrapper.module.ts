import { Module } from '@nestjs/common';
import { MetadataPreviewService } from './metadata-preview/metadata-preview.service';
import { MetadataPreviewController } from './metadata-preview/metadata-preview.controller';

@Module({
    providers: [MetadataPreviewService],
    controllers: [MetadataPreviewController],
})
export class MetaDataScrapperModule {}
