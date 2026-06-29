import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

export interface ListingMetadata {
  url: string;
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  images?: string[];
  address?: string;
  source: 'html' | 'playwright';
}

interface SchemaAddress {
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
}

interface SchemaOffer {
  price?: string | number;
  lowPrice?: string | number;
  priceCurrency?: string;
}

interface ListingSchema {
  '@type'?: string;
  '@graph'?: ListingSchema[];
  mainEntity?: ListingSchema;

  name?: string;
  description?: string;

  image?: string | string[];

  address?: SchemaAddress;

  offers?: SchemaOffer;

  price?: string | number;
  priceCurrency?: string;
}

@Injectable()
export class MetadataScraperService {
  private readonly logger = new Logger(MetadataScraperService.name);

  async scrape(url: string): Promise<ListingMetadata> {
    try {
      const htmlResult = await this.scrapeHtml(url);

      if (this.isValidResult(htmlResult)) {
        return {
          ...htmlResult,
          source: 'html',
        };
      }

      this.logger.log(`Métadonnées insuffisantes, fallback Playwright: ${url}`);

      return await this.scrapeWithPlaywright(url);
    } catch {
      this.logger.warn(`Erreur extraction HTML, fallback Playwright: ${url}`);

      return await this.scrapeWithPlaywright(url);
    }
  }

  private async scrapeHtml(
    url: string,
  ): Promise<Omit<ListingMetadata, 'source'>> {
    const response = await axios.get<string>(url, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html: string = response.data;

    return this.extractMetadata(html, url);
  }

  private async scrapeWithPlaywright(url: string): Promise<ListingMetadata> {
    const browser = await chromium.launch({
      headless: true,
    });

    try {
      const page = await browser.newPage();

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      const html = await page.content();

      const metadata = this.extractMetadata(html, url);

      return {
        ...metadata,
        source: 'playwright',
      };
    } finally {
      await browser.close();
    }
  }

  private extractMetadata(
    html: string,
    url: string,
  ): Omit<ListingMetadata, 'source'> {
    const $ = cheerio.load(html);

    const schemas = this.extractSchemas($);

    const listing = this.findBestSchema(schemas);

    const price =
      listing?.offers?.price ?? listing?.price ?? listing?.offers?.lowPrice;
    console.log('TITLE TAG', $('title').text());

    console.log('OG TITLE', $('meta[property="og:title"]').attr('content'));

    console.log(
      'JSON LD COUNT',
      $('script[type="application/ld+json"]').length,
    );

    const title = this.decodeHtml(
      listing?.name ||
        $('meta[property="og:title"]').attr('content') ||
        $('title').text().trim(),
    );

    const description = this.decodeHtml(
      listing?.description ||
        $('meta[property="og:description"]').attr('content') ||
        '',
    );
    return {
      url,
      title,
      description,
      price: price !== undefined ? Number(price) : undefined,

      currency: listing?.offers?.priceCurrency || listing?.priceCurrency,

      images: this.extractImages(listing),

      address: this.extractAddress(listing),
    };
  }

  private extractSchemas($: cheerio.CheerioAPI): ListingSchema[] {
    const schemas: ListingSchema[] = [];

    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const raw = $(element).html();

        if (!raw) {
          return;
        }

        const parsed: unknown = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          schemas.push(...parsed.filter((item) => this.isListingSchema(item)));
        } else if (this.isListingSchema(parsed)) {
          schemas.push(parsed);
        }
      } catch {
        // ignore invalid json
      }
    });

    return schemas;
  }

  private isListingSchema(value: unknown): value is ListingSchema {
    return typeof value === 'object' && value !== null;
  }

  private findBestSchema(schemas: ListingSchema[]): ListingSchema | null {
    const types = [
      'RealEstateListing',
      'Apartment',
      'House',
      'Residence',
      'SingleFamilyResidence',
      'Offer',
      'Product',
    ];

    for (const schema of schemas) {
      if (schema['@type'] && types.includes(schema['@type'])) {
        return schema;
      }

      if (schema.mainEntity) {
        return schema.mainEntity;
      }

      if (schema['@graph']) {
        const found = schema['@graph'].find(
          (item): item is ListingSchema =>
            !!item['@type'] && types.includes(item['@type']),
        );

        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  private decodeHtml(value: string): string {
    return cheerio.load(`<div>${value}</div>`)('div').text();
  }

  private extractImages(schema: ListingSchema | null): string[] {
    if (!schema?.image) {
      return [];
    }

    return Array.isArray(schema.image) ? schema.image : [schema.image];
  }

  private extractAddress(schema: ListingSchema | null): string | undefined {
    const address = schema?.address;

    if (!address) {
      return undefined;
    }

    const parts = [
      address.streetAddress,
      address.postalCode,
      address.addressLocality,
    ].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );

    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  private isValidResult(data: Omit<ListingMetadata, 'source'>): boolean {
    return Boolean(
      data.title || data.price || data.description || data.images?.length,
    );
  }
}
