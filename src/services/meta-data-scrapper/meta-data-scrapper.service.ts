import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { BrowserContext, chromium } from 'playwright';
import { CheerioAPI } from 'cheerio';
import { PropertyFeatures } from './interfaces/property-features.interface';
import { PrismaService } from '../prisma/prisma.service';
import { OpenaiService } from '../openai/openai.service';

interface SchemaAddress {
    streetAddress?: string;
    codePostal?: string;
    addressLocality?: string;
    addressRegion?: string;
}

export interface VerifyExtractedMetadataResult {
    metadata: Partial<ListingMetadata>;

    corrected: boolean;
    confidence: number;
    corrections: string[];
    reason?: string;
}

export interface ListingMetadata {
    // Origine
    source: 'html' | 'playwright' | 'manual';

    url?: string;

    // Informations générales
    title?: string;
    description?: string;

    // Localisation (SOURCE BRUTE)
    address?: string;
    streetAddress?: string;
    city?: string;
    codePostal?: string;
    codeInsee?: string;
    latitude?: number;
    longitude?: number;

    // Bien
    typeLocal?: 'Maison' | 'Appartement' | 'Terrain' | 'Local commercial' | 'Parking' | 'Immeuble' | 'Inconnu';

    surface?: number;
    rooms?: number;
    terrain?: number;
    floor?: number | null;

    condition?: string;
    dpe?: string;

    propertyFeatures?: PropertyFeatures;
    featureLabels?: string[];

    // Prix
    price?: number;
    currency?: string;
    // Médias
    images?: string[];
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
export class MetadataScraperService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MetadataScraperService.name);

    private normalizeUrl(url: string): string {
        try {
            const parsedUrl = new URL(url);

            if (parsedUrl.hostname.includes('seloger.com')) {
                return `${parsedUrl.origin}${parsedUrl.pathname}?utm_medium=desktop-web&utm_source=seloger&utm_campaign=on-site_message-sharing&utm_content=cdp&utm_term=sharing`;
            }

            if (parsedUrl.hostname.includes('logic-immo.com')) {
                return `${parsedUrl.origin}${parsedUrl.pathname}?utm_medium=desktop-web&utm_source=logicimmo&utm_campaign=on-site_message-sharing&utm_content=cdp&utm_term=sharing`;
            }

            return url;
        } catch {
            return url;
        }
    }

    private browser;

    constructor(
        private readonly prisma: PrismaService,
        private readonly openAiService: OpenaiService,
    ) {}

    async onModuleInit() {
        // this.browser = await chromium.launch({
        //     headless: false,
        // });
    }

    async onModuleDestroy() {
        await this.browser.close();
    }

    async scrape(url: string): Promise<ListingMetadata> {
        const normalizedUrl = this.normalizeUrl(url);

        this.logger.log(`URL originale : ${url}`);
        this.logger.log(`URL utilisée scraping : ${normalizedUrl}`);

        try {
            const htmlResult = await this.scrapeHtml(normalizedUrl);
            if (this.isValidResult(htmlResult)) {
                return {
                    ...htmlResult,
                    source: 'html' as const,
                };
            }

            this.logger.log(`Métadonnées insuffisantes, fallback Playwright: ${normalizedUrl}`);

            return await this.scrapeWithPlaywright(normalizedUrl);
        } catch (error) {
            console.error('AXIOS ERROR', error);

            this.logger.warn(`Erreur extraction HTML, fallback Playwright: ${normalizedUrl}`);

            return await this.scrapeWithPlaywright(normalizedUrl);
        }
    }

    private async scrapeHtml(url: string): Promise<Omit<ListingMetadata, 'source'>> {
        const response = await axios.get<string>(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        const html: string = response.data;

        return this.extractMetadata(html, url);
    }

    private async scrapeWithPlaywright(url: string): Promise<ListingMetadata> {
        const browser = await this.getBrowser();

        const context = await browser.newContext({
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',

            viewport: {
                width: 1440,
                height: 900,
            },

            locale: 'fr-FR',

            timezoneId: 'Europe/Paris',

            javaScriptEnabled: true,
        });

        const page = await context.newPage();

        try {
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            });

            console.log('PAGE TITLE:', await page.title());

            await page.waitForTimeout(5000);

            let html = await page.content();

            const isChallenge =
                html.includes('Just a moment') ||
                html.includes('Enable JavaScript and cookies') ||
                html.includes('captcha-delivery.com') ||
                html.includes('DataDome') ||
                html.includes('datadome');

            if (isChallenge) {
                console.log('⚠️ Challenge anti-bot détecté');

                await page.waitForTimeout(30000);

                console.log('URL après challenge:', page.url());
                console.log('TITLE après challenge:', await page.title());

                html = await page.content();
            }

            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            });

            await page.screenshot({
                path: 'logic-immo-debug.png',
                fullPage: true,
            });

            if (html.includes('captcha-delivery.com') || html.includes('DataDome') || html.includes('datadome')) {
                throw new Error('DataDome non résolu');
            }

            const finalTitle = await page.title();

            console.log('FINAL TITLE:', finalTitle);

            if (html.includes('Just a moment') || html.includes('Enable JavaScript and cookies')) {
                throw new Error('Cloudflare challenge non résolu');
            }

            return {
                ...(await this.extractMetadata(html, url)),
                source: 'playwright' as const,
            };
        } finally {
            await context.close();
        }
    }

    private async extractMetadata(html: string, url: string): Promise<Omit<ListingMetadata, 'source'>> {
        const $: CheerioAPI = cheerio.load(html);

        const schemas: ListingSchema[] = this.extractSchemas($);

        const listing = this.findBestSchema(schemas);

        const title: string = this.decodeHtml(
            listing?.name || $('meta[property="og:title"]').attr('content') || $('title').text().trim(),
        );
        console.log('titre', title);
        const description: string = this.decodeHtml(
            listing?.description || $('meta[property="og:description"]').attr('content') || '',
        );
        console.log('description', description);
        const ogImage = $('meta[property="og:image"]').attr('content');

        const images: string[] = this.extractImages(listing, ogImage, $);

        // Texte complet disponible pour les fallback
        const fullText = `
      ${title}
      ${description}
      ${$('title').text()}
      ${$('meta[property="og:title"]').attr('content') ?? ''}
      ${$('meta[property="og:description"]').attr('content') ?? ''}
      ${$('body').text()}
    `;
        const price = this.extractPriceFromAllSources({
            listing,
            title: $('title').text(),
            ogTitle: $('meta[property="og:title"]').attr('content') ?? '',
            ogDescription: $('meta[property="og:description"]').attr('content') ?? '',
            body: $('body').text(),
        });

        const surface = this.extractSurface(fullText);
        const terrain = this.extractTerrainSurface(fullText);
        const typeLocal = this.detectTypeLocal(title, description);
        const propertyFeatures = this.extractPropertyFeatures(title, description);
        const rooms = this.extractRooms(title);

        const location = await this.extractLocation({
            listing,
            title,
            description,
            url,
        });

        const verified = await this.openAiService.verifyExtractedMetadata({
            url,
            title,
            description,
            body: fullText,
            extracted: {
                ...location,

                typeLocal,
                surface,
                terrain,
                rooms,

                propertyFeatures,

                price,
            },
        });

        console.log('verifyExtractedMetadata', verified);

        return {
            url,
            title,
            description,
            price: verified.price ?? price,
            currency: listing?.offers?.priceCurrency || listing?.priceCurrency || 'EUR',
            images,

            address: verified.address,
            streetAddress: verified.streetAddress,
            city: verified.city,
            codePostal: verified.codePostal,

            surface: verified.surface,
            terrain: verified.terrain ?? terrain,
            typeLocal: verified.typeLocal,
            rooms: verified.rooms,

            propertyFeatures: verified.propertyFeatures,
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

    private extractTerrainSurface(text: string): number | undefined {
        const patterns = [
            /terrain\s*(?:de|:)?\s*(\d+(?:[ .]\d+)*)\s*m²/i,
            /parcelle\s*(?:de|:)?\s*(\d+(?:[ .]\d+)*)\s*m²/i,
            /surface\s*du\s*terrain\s*(?:de|:)?\s*(\d+(?:[ .]\d+)*)\s*m²/i,
            /jardin\s*(?:de|:)?\s*(\d+(?:[ .]\d+)*)\s*m²/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (match) {
                return Number(match[1].replace(/[ .]/g, ''));
            }
        }

        return undefined;
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
                    (item): item is ListingSchema => !!item['@type'] && types.includes(item['@type']),
                );

                if (found) {
                    return found;
                }
            }
        }

        return null;
    }

    private async getBrowser() {
        if (!this.browser || !this.browser.isConnected()) {
            this.logger.log('🚀 Launch Chromium');

            this.browser = await chromium.launch({
                headless: false,
                args: ['--disable-blink-features=AutomationControlled'],
            });
        }

        return this.browser;
    }

    private decodeHtml(value: string): string {
        return cheerio.load(`<div>${value}</div>`)('div').text();
    }

    private extractImages(schema: ListingSchema | null, ogImage?: string, $?: CheerioAPI): string[] {
        const images: string[] = [];

        // JSON LD
        if (schema?.image) {
            if (Array.isArray(schema.image)) {
                images.push(...schema.image);
            } else {
                images.push(schema.image);
            }
        }

        // Open Graph
        if (ogImage) {
            images.push(ogImage);
        }

        // Meta images supplémentaires
        if ($) {
            $('meta[property="og:image"]').each((_, el) => {
                const src = $(el).attr('content');

                if (src) {
                    images.push(src);
                }
            });
        }

        return [...new Set(images)];
    }

    private extractAddress(schema: ListingSchema | null): string | undefined {
        const address = schema?.address;

        if (!address) {
            return undefined;
        }

        const parts = [address.streetAddress, address.codePostal, address.addressLocality].filter(
            (value): value is string => typeof value === 'string' && value.length > 0,
        );

        return parts.length > 0 ? parts.join(', ') : undefined;
    }

    private extractCityFromUrl(url?: string): string | undefined {
        if (!url) {
            return undefined;
        }

        try {
            const pathname = new URL(url).pathname;

            // Exemple :
            // /annonces/achat/appartement/cannes-06/le-grand-jas/276029383.htm

            const segments = pathname.split('/').filter(Boolean);

            // Recherche le segment contenant "-06", "-75", "-974", etc.
            const citySegment = segments.find((segment) => /-\d{2,3}$/.test(segment));

            if (!citySegment) {
                return undefined;
            }

            let city = citySegment
                .replace(/-\d{2,3}$/, '')
                .replace(/-/g, ' ')
                .trim();

            // Supprime "15eme", "4e", "1er"...
            city = city.replace(/\b\d{1,2}(?:er|eme|e)?\b/gi, '').trim();

            return city;
        } catch {
            return undefined;
        }
    }

    private isValidResult(data: Omit<ListingMetadata, 'source'>): boolean {
        return Boolean(data.title || data.price || data.description || data.images?.length);
    }

    private extractPropertyFeatures(title: string, description: string): PropertyFeatures {
        const text = `${title} ${description}`
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

        console.log('================ FEATURES TEXT ================');
        console.log(text.substring(0, 5000));
        console.log('===============================================');
        /**
         * Détecte une caractéristique présente
         * mais ignore les négations :
         * - sans ascenseur
         * - pas d'ascenseur
         * - absence d'ascenseur
         */
        const has = (...patterns: string[]) => {
            return patterns.some((pattern) => {
                const regex = new RegExp(
                    `(?<!sans |sans d'|sans l'|pas d'|pas de |absence d'|absence de |aucun |aucune )\\b${pattern}\\b`,
                    'i',
                );

                return regex.test(text);
            });
        };

        return {
            // Architecture
            duplex: has('duplex'),
            triplex: has('triplex'),
            loft: has('loft'),

            // Extérieurs
            terrasse: has('terrasse'),
            balcon: has('balcon'),
            loggia: has('loggia'),
            jardin: has('jardin'),
            patio: has('patio'),

            // Luxe
            piscine: has('piscine'),
            jacuzzi: has('jacuzzi'),
            spa: has('spa'),
            sauna: has('sauna'),

            // Stationnement
            parking: has('parking'),
            garage: has('garage'),
            box: has('box'),

            // Annexes
            cave: has('cave'),
            grenier: has('grenier'),

            // Immeuble
            ascenseur: has('ascenseur'),
            gardien: has('gardien'),
            interphone: has('interphone'),
            digicode: has('digicode'),
            visiophone: has('visiophone'),

            // Confort
            climatisation: has('climatisation', 'clim'),

            cheminee: has('cheminee', 'cheminee'),

            cuisineEquipee: has('cuisine equipee', 'cuisine amenagee', 'cuisine americaine equipee'),

            dressing: has('dressing'),

            buanderie: has('buanderie'),

            // Vue
            vueMer: has('vue mer'),
            vueMontagne: has('vue montagne'),
            vuePanoramique: has('vue panoramique'),
            vueDegagee: has('vue degagee'),

            // Situation
            dernierEtage: has('dernier etage', 'dernier étage'),

            traversant: has('traversant'),

            lumineux: has('lumineux', 'tres lumineux'),

            calme: has('calme'),

            // Etat
            renove: has('renove', 'entierement renove', 'refait a neuf', 'renove recemment'),

            // Standing
            standing: has('standing'),

            prestige: has(
                'prestige',
                'prestigieux',
                'prestigieuse',
                'haut de gamme',
                'exception',
                'rare',
                'rare sur le secteur',
                'quartier prestigieux',
            ),
        };
    }

    private detectTypeLocal(
        title: string,
        description: string,
    ): 'Maison' | 'Appartement' | 'Terrain' | 'Local commercial' | 'Parking' | 'Immeuble' | 'Inconnu' {
        const normalize = (value: string) =>
            value
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();

        const titleText = normalize(title);
        const descriptionText = normalize(description);
        const text = `${titleText} ${descriptionText}`;

        // =====================================================
        // 1. PRIORITÉ AU TITRE (beaucoup plus fiable)
        // =====================================================

        if (titleText.startsWith('maison')) return 'Maison';
        if (titleText.startsWith('appartement')) return 'Appartement';
        if (titleText.startsWith('terrain')) return 'Terrain';
        if (titleText.startsWith('local commercial')) return 'Local commercial';
        if (titleText.startsWith('parking')) return 'Parking';
        if (titleText.startsWith('garage')) return 'Parking';
        if (titleText.startsWith('box')) return 'Parking';
        if (titleText.startsWith('immeuble')) return 'Immeuble';

        // =====================================================
        // 2. TERRAIN
        // =====================================================

        if (
            text.includes('terrain a batir') ||
            text.includes('terrain constructible') ||
            text.includes('terrain viabilise') ||
            text.includes('terrain')
        ) {
            return 'Terrain';
        }

        // =====================================================
        // 3. LOCAL COMMERCIAL
        // =====================================================

        if (
            text.includes('local commercial') ||
            text.includes('fonds de commerce') ||
            text.includes('murs commerciaux') ||
            text.includes('cellule commerciale') ||
            text.includes('boutique') ||
            text.includes('local professionnel')
        ) {
            return 'Local commercial';
        }

        // =====================================================
        // 4. PARKING
        // =====================================================

        if (text.includes('parking') || text.includes('garage') || text.includes('box')) {
            return 'Parking';
        }

        // =====================================================
        // 5. IMMEUBLE
        // ATTENTION : ne pas tester le simple mot "immeuble"
        // =====================================================

        if (
            text.includes('immeuble de rapport') ||
            text.includes('immeuble entier') ||
            text.includes('vente immeuble') ||
            text.includes('batiment entier')
        ) {
            return 'Immeuble';
        }

        // =====================================================
        // 6. MAISON
        // =====================================================

        if (
            text.includes('maison') ||
            text.includes('maison de ville') ||
            text.includes('villa') ||
            text.includes('pavillon') ||
            text.includes('propriete') ||
            text.includes('mas') ||
            text.includes('bastide')
        ) {
            return 'Maison';
        }

        // =====================================================
        // 7. APPARTEMENT
        // =====================================================

        if (
            text.includes('appartement') ||
            text.includes('studio') ||
            text.includes('studette') ||
            text.includes('duplex') ||
            text.includes('triplex') ||
            text.includes('loft')
        ) {
            return 'Appartement';
        }

        // =====================================================
        // 8. T1 / T2 / F2 / F3...
        // =====================================================

        if (/\b[tf][1-9]\b/.test(text)) {
            return 'Appartement';
        }

        return 'Inconnu';
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

        const jsonLdPrice = data.listing?.offers?.price ?? data.listing?.price ?? data.listing?.offers?.lowPrice;

        if (jsonLdPrice) {
            const parsed = Number(String(jsonLdPrice).replace(/[^\d]/g, ''));

            if (!isNaN(parsed)) {
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

        const matches = fullText.match(/(\d{1,3}(?:[\s\.]\d{3})+|\d{4,6})\s*(?:€|euros?)/gi);

        if (!matches) {
            console.log('NO PRICE FOUND');
            return undefined;
        }

        const prices = matches.map((value) => {
            const number = value.replace(/[^\d]/g, '');

            return Number(number);
        });

        // On garde un prix immobilier réaliste
        const validPrices = prices.filter((price) => price >= 20000 && price <= 5000000);

        if (!validPrices.length) {
            return undefined;
        }

        return validPrices[0];
    }

    private extractCommuneFromTitle(title: string): string | undefined {
        if (!title) return undefined;

        const patterns = [
            // Saint-Thibault-des-Vignes (77400)
            /\b([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+?)\s*\(\d{5}\)/,

            // Vente appartement ... Saint-Thibault-des-Vignes - 148000 €
            /,\s*([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+?)\s*-\s*\d[\d\s]*€/,

            // Appartement à Paris 9
            /\b(?:à|a)\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+?)(?:\s+\d{1,2}(?:er|e)?)?(?:\b|$)/i,

            // 75009 Paris
            /\b\d{5}\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+)/i,
        ];

        for (const pattern of patterns) {
            const match = title.match(pattern);

            if (match?.[1]) {
                return match[1].trim();
            }
        }

        return undefined;
    }

    private extractCommuneFromText(text: string): string | undefined {
        if (!text) {
            return undefined;
        }

        const patterns = [
            // 75009 Paris
            /\b\d{5}\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+)/i,

            // Paris (75009)
            /([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+?)\s*\(\s*\d{5}\s*\)/i,

            // à Paris 9
            /\b(?:à|a)\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+?)(?:\s+\d{1,2}(?:er|e)?)?(?=\s*(?:[:|,.;()-]|$))/i,

            // situé à Paris
            /\bsitu[eé](?:e)?\s+à\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+?)(?:\s+\d{1,2}(?:er|e)?)?(?=\s*(?:[:|,.;()-]|$))/i,

            // commune de Paris
            /\bcommune\s+de\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+)/i,

            // ville de Paris
            /\bville\s+de\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+)/i,

            // secteur Paris
            /\bsecteur\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+)/i,

            // - Paris 9 | Ref...
            /-\s*([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]+?)(?:\s+\d{1,2}(?:er|e)?)?\s*(?:\||$)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (match?.[1]) {
                return match[1].trim();
            }
        }

        return undefined;
    }

    private async extractLocation(data: {
        listing: ListingSchema | null;
        title: string;
        ogTitle?: string;
        description?: string;
        url?: string;
    }) {
        const address = data.listing?.address;

        let streetAddress = address?.streetAddress;
        let codePostal = address?.codePostal;
        let city: string | undefined;

        const rawAddressCity = address?.addressLocality;

        console.log('INITIAL CITY:', city);
        console.log('ADDRESS LOCALITY:', rawAddressCity);
        console.log('TITLE:', data.title);

        const text = [
            data.title,
            data.ogTitle,
            data.description,
            data.url,
            streetAddress,
            rawAddressCity,
            this.extractAddress(data.listing),
        ]
            .filter(Boolean)
            .join(' ');

        // ----------------------------
        // 1. EXTRACTION RUE
        // ----------------------------

        if (!streetAddress) {
            streetAddress = this.extractStreetAddress(text);
        }

        // ----------------------------
        // 2. EXTRACTION CODE POSTAL
        // ----------------------------

        if (!codePostal) {
            const match = text.match(/\(([0-9]{5})\)/);

            if (match) {
                codePostal = match[1];
            }
        }

        if (!codePostal) {
            const cp = text.match(/\b(0[1-9]|[1-8]\d|9[0-5])\d{3}\b(?!\s*(€|euros?))/i);

            codePostal = cp?.[0];
        }

        if (!codePostal) {
            codePostal = this.extractParisArrondissementCodePostal(text);
        }

        // ----------------------------
        // 3. RESOLUTION COMMUNE VIA DVF
        // ----------------------------

        if (codePostal) {
            const candidates = [
                rawAddressCity,
                this.extractCommuneFromTitle(data.title),
                this.extractCommuneFromTitle(data.ogTitle ?? ''),
                this.extractCommuneFromText(data.description ?? ''),
            ]
                .filter(Boolean)
                .map((c) => this.normalizeCity(c!));

            console.log('CITY CANDIDATES:', candidates);

            for (const candidate of candidates) {
                const match = await this.prisma.dvfTransaction.findFirst({
                    where: {
                        codePostal,
                        city: candidate,
                    },
                    select: {
                        city: true,
                    },
                });

                if (match?.city) {
                    city = match.city;

                    this.logger.log(`🏙️ MATCH DVF CITY : ${city}`);

                    break;
                }
            }

            // fallback CP uniquement
            if (!city) {
                const communes = await this.prisma.dvfTransaction.findMany({
                    where: {
                        codePostal,
                    },
                    select: {
                        city: true,
                    },
                    distinct: ['city'],
                });

                if (communes.length === 1) {
                    city = communes[0].city ?? undefined;
                }
            }
        }

        // ----------------------------
        // 4. FALLBACK SI PAS TROUVE
        // ----------------------------

        // priorité titre
        if (!city) {
            city = this.extractCommuneFromTitle(data.title);
        }

        // ensuite ogTitle
        if (!city && data.ogTitle) {
            city = this.extractCommuneFromTitle(data.ogTitle);
        }

        // ensuite URL
        if (!city && data.url) {
            city = this.extractCityFromUrl(data.url);
        }

        // ensuite seulement texte
        if (!city) {
            city = this.extractCommuneFromText(text);
        }

        // ----------------------------
        // 5. VALIDATION DVF
        // ----------------------------

        city = await this.validateCityWithDvf(city, codePostal);

        // ----------------------------
        // 6. NORMALISATION FINALE
        // ----------------------------

        city = this.normalizeCity(city);

        console.log('FINAL SCRAP CITY BEFORE RETURN:', city);

        return {
            streetAddress,
            city,
            codePostal,
            address: [streetAddress, codePostal, city].filter(Boolean).join(', '),
        };
    }

    private extractParisArrondissementCodePostal(text: string): string | undefined {
        if (!text) {
            return undefined;
        }

        const match = text.match(/\bParis\s+(\d{1,2})(?:er|e)?\b/i);

        if (!match) {
            return undefined;
        }

        const arrondissement = Number(match[1]);

        if (arrondissement < 1 || arrondissement > 20) {
            return undefined;
        }

        return `750${arrondissement.toString().padStart(2, '0')}`;
    }

    private async validateCityWithDvf(city: string | undefined, codePostal?: string): Promise<string | undefined> {
        if (!city || !codePostal) {
            return undefined;
        }

        const normalized = this.normalizeCity(city);

        const match = await this.prisma.dvfTransaction.findFirst({
            where: {
                codePostal,
                city: normalized,
            },
            select: {
                city: true,
            },
        });

        return match?.city ?? undefined;
    }

    private normalizeCity(city?: string): string | undefined {
        if (!city) {
            return undefined;
        }

        return (
            city

                // suppression arrondissements complets
                // 15EME, 15ÈME, 15E, 1ER, 1ER ARRONDISSEMENT
                .replace(/\b\d{1,2}(?:ER|E|EME|ÈME)?\b/gi, '')

                // suppression suffixe restant après suppression du chiffre
                .replace(/\b(ER|EME|ÈME|E)\b/gi, '')

                .replace(/\bARRONDISSEMENT\b/gi, '')

                // suppression accents
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')

                // apostrophes
                .replace(/['’]/g, ' ')

                // caractères inutiles
                .replace(/[^A-Za-z\s'-]/g, '')

                // espaces
                .replace(/\s+/g, ' ')
                .trim()

                // majuscules
                .toUpperCase()

                // format DVF
                .replace(/\s+/g, '-')

                // nettoyage final
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
        );
    }

    private extractStreetAddress(text: string): string | undefined {
        const streetTypes = [
            'rue',
            'avenue',
            'av\\.?',

            'boulevard',
            'bd\\.?',

            'chemin',
            'route',
            'impasse',
            'allée',
            'allee',
            'quai',
            'place',
            'cours',
            'square',
            'passage',
            'voie',
        ].join('|');

        const regex = new RegExp(`\\b(?:${streetTypes})\\s+([A-Za-zÀ-ÿ0-9'’\\- ]{3,80})`, 'i');

        const match = text.match(regex);

        if (!match) {
            return undefined;
        }

        let street = match[0];

        // On coupe dès qu'on rencontre des mots qui indiquent
        // que la description commence
        street = street.split(
            /\b(?:studio|appartement|maison|villa|loft|t1|t2|t3|t4|t5|lumineux|calme|avec|sans|dans|de|sur)\b/i,
        )[0];

        return street.trim().replace(/[ ,;|–-]+$/, '');
    }

    private extractRooms(text: string): number | undefined {
        const normalized = text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

        // T2, T3, T4
        const tMatch = normalized.match(/\bt(\d+)\b/);

        if (tMatch) {
            return Number(tMatch[1]);
        }

        // F2, F3, F4
        const fMatch = normalized.match(/\bf(\d+)\b/);

        if (fMatch) {
            return Number(fMatch[1]);
        }

        // 2 pieces, 3 pieces
        const piecesMatch = normalized.match(/(\d+)\s*pieces?/);

        if (piecesMatch) {
            return Number(piecesMatch[1]);
        }

        // Studio = T1
        if (normalized.includes('studio')) {
            return 1;
        }

        return undefined;
    }
}
