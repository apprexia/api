import { Body, Controller, Post } from '@nestjs/common';
import { MetadataPreviewService } from './metadata-preview.service';
import { ListingPreview } from '../interfaces/listing-preview.interface';

@Controller('metadata-preview')
export class MetadataPreviewController {
    constructor(private readonly metadataPreviewService: MetadataPreviewService) {}

    @Post('preview')
    async preview(@Body('url') url: string): Promise<ListingPreview> {
        if (!url) {
            throw new Error('URL manquante');
        }

        return this.metadataPreviewService.getQuickPreview(url);
    }
}
