import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { CheerioAPI } from 'cheerio';

export interface ListingMetadata {
  // Origine
  source: 'html' | 'playwright' | 'manual';

  url?: string;

  // Informations générales
  title?: string;
  description?: string;

  // Localisation
  address?: string;
  commune?: string;
  postalCode?: string;

  latitude?: number;
  longitude?: number;

  // Bien
  typeLocal?: 'Maison' | 'Appartement';

  surface?: number;

  rooms?: number;

  floor?: number | null;

  condition?: string;

  dpe?: string;

  balcony?: boolean;

  parking?: boolean;

  // Prix
  price?: number;

  currency?: string;

  // Médias
  images?: string[];
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
    } catch (error) {
      console.error('AXIOS ERROR', error);

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
      headless: false,
    });

    try {
      const page = await browser.newPage();

      await page.goto(url, {
        waitUntil: 'networkidle',
      });

      await page.waitForTimeout(5000);

      const html: string = await page.content();

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
    const $: CheerioAPI = cheerio.load(html);

    const schemas: ListingSchema[] = this.extractSchemas($);

    const listing = this.findBestSchema(schemas);

    console.log('TITLE TAG', $('title').text());

    console.log('OG TITLE', $('meta[property="og:title"]').attr('content'));

    console.log(
      'JSON LD COUNT',
      $('script[type="application/ld+json"]').length,
    );

    const title: string = this.decodeHtml(
      listing?.name ||
        $('meta[property="og:title"]').attr('content') ||
        $('title').text().trim(),
    );

    const description: string = this.decodeHtml(
      listing?.description ||
        $('meta[property="og:description"]').attr('content') ||
        '',
    );

    const ogImage = $('meta[property="og:image"]').attr('content');

    const images: string[] = this.extractImages(listing, ogImage);

    // Texte complet disponible pour les fallback
    const fullText = `
    ${title}
    ${description}
    ${$('title').text()}
    ${$('meta[property="og:title"]').attr('content') ?? ''}
    ${$('meta[property="og:description"]').attr('content') ?? ''}
    ${$('body').text()}
  `;

    const address =
      this.extractAddress(listing) || this.extractAddressFromText(fullText);

    const price = this.extractPriceFromAllSources({
      listing,
      title: $('title').text(),
      ogTitle: $('meta[property="og:title"]').attr('content') ?? '',
      ogDescription: $('meta[property="og:description"]').attr('content') ?? '',
      body: $('body').text(),
    });

    const surface = this.extractSurface(fullText);

    const commune = this.extractCommune(address ?? fullText);

    const typeLocal = this.detectTypeLocal(title, description);

    return {
      url,

      title,

      description,

      price: price !== undefined ? Number(price) : undefined,

      currency:
        listing?.offers?.priceCurrency || listing?.priceCurrency || 'EUR',

      images,

      address,

      surface,

      commune,

      typeLocal,
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

  private extractSurface(text: string): number | undefined {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s?m²/i);

    if (!match) {
      return undefined;
    }

    return Number(match[1].replace(',', '.'));
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

  private extractImages(
    schema: ListingSchema | null,
    ogImage?: string,
  ): string[] {
    if (schema?.image) {
      return Array.isArray(schema.image) ? schema.image : [schema.image];
    }

    if (ogImage) {
      return [ogImage];
    }

    return [];
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

  private extractAddressFromText(text: string): string | undefined {
    const match = text.match(/\b\d{5}\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ\- ]+/i);

    return match?.[0];
  }

  private isValidResult(data: Omit<ListingMetadata, 'source'>): boolean {
    return Boolean(
      data.title || data.price || data.description || data.images?.length,
    );
  }

  private extractCommune(address?: string): string | undefined {
    if (!address) {
      return undefined;
    }

    // Nettoyage des scripts parasites
    const cleanAddress = address
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/var\s+[\s\S]*?;/gi, '')
      .replace(/FIREWHENREADY\(\);/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanAddress) {
      return undefined;
    }

    const parts = cleanAddress
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (!parts.length) {
      return undefined;
    }

    let commune = parts[parts.length - 1];

    // Si le dernier élément ressemble à un code postal
    if (/^\d+$/.test(commune)) {
      commune = parts[parts.length - 2];
    }

    return (
      commune
        .replace(/[0-9]/g, '')
        .replace(/-/g, ' ')
        .replace(/[^\p{L}\s]/gu, '')
        .trim()
        .toUpperCase() || undefined
    );
  }

  private detectTypeLocal(
    title: string,
    description: string,
  ): 'Maison' | 'Appartement' | undefined {
    const text = `${title} ${description}`.toLowerCase();

    if (
      text.includes('appartement') ||
      text.includes('studio') ||
      text.includes('t1') ||
      text.includes('t2') ||
      text.includes('t3') ||
      text.includes('t4') ||
      text.includes('t5')
    ) {
      return 'Appartement';
    }

    if (
      text.includes('maison') ||
      text.includes('pavillon') ||
      text.includes('villa')
    ) {
      return 'Maison';
    }

    return undefined;
  }

  private extractPriceFromAllSources(data: {
    listing?: ListingSchema | null;
    title: string;
    ogTitle: string;
    ogDescription: string;
    body: string;
  }): number | undefined {
    // ----------------------------
    // 1) JSON-LD
    // ----------------------------

    const jsonLdPrice =
      data.listing?.offers?.price ??
      data.listing?.price ??
      data.listing?.offers?.lowPrice;

    if (jsonLdPrice) {
      const parsed = Number(String(jsonLdPrice).replace(/[^\d]/g, ''));

      if (!isNaN(parsed)) {
        console.log('PRICE FROM JSON-LD:', parsed);
        return parsed;
      }
    }

    // ----------------------------
    // 2) Texte complet
    // ----------------------------

    const fullText = `
    ${data.title}
    ${data.ogTitle}
    ${data.ogDescription}
    ${data.body}
  `;

    // Exemple :
    // 199.000 €
    // 276000 €
    // 160 000 euros

    const matches = fullText.match(
      /(\d{1,3}(?:[\s\.]\d{3})+|\d{4,6})\s*(?:€|euros?)/gi,
    );

    if (!matches) {
      console.log('NO PRICE FOUND');
      return undefined;
    }

    const prices = matches.map((value) => {
      const number = value.replace(/[^\d]/g, '');

      return Number(number);
    });

    // On garde un prix immobilier réaliste
    const validPrices = prices.filter(
      (price) => price >= 20000 && price <= 5000000,
    );

    if (!validPrices.length) {
      return undefined;
    }

    console.log('PRICE FROM TEXT:', validPrices[0]);

    return validPrices[0];
  }
}
