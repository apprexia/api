import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ListingPreview, ListingPreviewPlatform } from '../interfaces/listing-preview.interface';

@Injectable()
export class MetadataPreviewService {
    private readonly logger = new Logger(MetadataPreviewService.name);

    async getQuickPreview(url: string): Promise<ListingPreview> {
        const normalizedUrl = this.normalizeUrl(url);
        const platform = this.detectPlatform(normalizedUrl);

        try {
            const response = await axios.get<string>(normalizedUrl, {
                timeout: 5000,
                maxRedirects: 5,

                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',

                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',

                    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                },
            });

            const html = response.data;

            if (!html || html.length < 100) {
                throw new Error('HTML vide ou invalide');
            }

            const $ = cheerio.load(html);

            const title =
                $('meta[property="og:title"]').attr('content')?.trim() ||
                $('meta[name="twitter:title"]').attr('content')?.trim() ||
                $('title').text().trim() ||
                undefined;

            const description =
                $('meta[property="og:description"]').attr('content')?.trim() ||
                $('meta[name="description"]').attr('content')?.trim() ||
                $('meta[name="twitter:description"]').attr('content')?.trim() ||
                undefined;

            const image =
                $('meta[property="og:image"]').attr('content')?.trim() ||
                $('meta[name="twitter:image"]').attr('content')?.trim() ||
                undefined;

            this.logger.log(`✅ Preview récupérée : ${platform} → ${title ?? 'sans titre'}`);

            return {
                url: normalizedUrl,
                platform,
                title,
                description,
                image,
            };
        } catch (error) {
            this.logger.warn(
                `⚠️ Preview impossible : ${normalizedUrl} → ${error instanceof Error ? error.message : error}`,
            );

            // Très important :
            // même si le site bloque la preview,
            // on retourne l'URL afin que le front puisse
            // proposer l'analyse.
            return {
                url: normalizedUrl,
                platform,
            };
        }
    }

    private normalizeUrl(url: string): string {
        if (!url || typeof url !== 'string') {
            throw new BadRequestException('URL invalide');
        }

        const value = url.trim();

        try {
            const parsed = new URL(value);

            if (!['http:', 'https:'].includes(parsed.protocol)) {
                throw new Error();
            }

            return parsed.toString();
        } catch {
            throw new BadRequestException('URL invalide');
        }
    }

    private detectPlatform(url: string): ListingPreviewPlatform {
        try {
            const hostname = new URL(url).hostname.toLowerCase();

            if (hostname.includes('leboncoin.fr')) {
                return 'leboncoin';
            }

            if (hostname.includes('seloger.com')) {
                return 'seloger';
            }

            if (hostname.includes('logic-immo.com')) {
                return 'logic-immo';
            }

            return 'other';
        } catch {
            return 'other';
        }
    }
}
