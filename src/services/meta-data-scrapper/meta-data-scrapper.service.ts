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
    ges?: string;

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

    private cleanUrl(rawUrl: string): string {
        if (!rawUrl) {
            return rawUrl;
        }

        // Cherche le début réel de l'URL
        const httpsIndex = rawUrl.indexOf('https://');

        if (httpsIndex === -1) {
            return rawUrl.trim();
        }

        let url = rawUrl.substring(httpsIndex).trim();

        // Supprime un éventuel texte parasite après l'URL
        const spaceIndex = url.search(/\s/);

        if (spaceIndex !== -1) {
            url = url.substring(0, spaceIndex);
        }

        // Nettoyage de caractères ajoutés autour de l'URL
        url = url.replace(/[)\]}>,]+$/, '');

        return url;
    }

    private normalizeUrl(rawUrl: string): string {
        const url = this.cleanUrl(rawUrl);

        try {
            const parsedUrl = new URL(url);

            const hostname = parsedUrl.hostname.toLowerCase();
            const pathname = parsedUrl.pathname.toLowerCase();

            // SELOGER
            if (hostname.includes('seloger.com')) {
                if (pathname.includes('/wl-cdp/')) {
                    return url;
                }

                return `${parsedUrl.origin}${parsedUrl.pathname}?utm_medium=desktop-web&utm_source=seloger&utm_campaign=on-site_message-sharing&utm_content=cdp&utm_term=sharing`;
            }

            // LOGIC-IMMO
            if (hostname.includes('logic-immo.com')) {
                if (/\/detail-vente-\d+\.htm/i.test(pathname) || pathname.includes('/detail-annonce/')) {
                    return url;
                }

                return `${parsedUrl.origin}${parsedUrl.pathname}?utm_medium=desktop-web&utm_source=logicimmo&utm_campaign=on-site_message-sharing&utm_content=cdp&utm_term=sharing`;
            }

            // LE BON COIN
            if (hostname.includes('leboncoin.fr')) {
                return url;
            }

            // Autres sites
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
        if (this.browser?.isConnected()) {
            await this.browser.close();
        }
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
            console.log('PAGE URL:', page.url());

            await page.waitForTimeout(3000);

            let html = await page.content();

            console.log('HTML LENGTH:', html.length);
            console.log('BODY TEXT:', (await page.locator('body').innerText()).substring(0, 2000));
            await page.screenshot({
                path: '/tmp/logic-immo-challenge.png',
                fullPage: true,
            });

            const isChallenge = this.isAntiBotPage(html);

            if (isChallenge) {
                this.logger.warn('⚠️ Challenge anti-bot détecté');
                this.logger.log('⏳ Attente résolution challenge...');

                // On attend que la page quitte le challenge
                try {
                    await page.waitForFunction(
                        () => {
                            const title = document.title.toLowerCase();
                            const body = document.body?.innerText?.toLowerCase() || '';

                            return (
                                !title.includes('just a moment') &&
                                !body.includes('enable javascript and cookies') &&
                                !body.includes('datadome') &&
                                !document.documentElement.innerHTML.toLowerCase().includes('captcha-delivery.com')
                            );
                        },
                        {
                            timeout: 30000,
                        },
                    );
                } catch {
                    this.logger.warn('⚠️ Challenge toujours présent après 30 secondes');
                }

                await page.waitForTimeout(2000);

                html = await page.content();
            }

            const finalTitle = await page.title();
            const finalUrl = page.url();

            this.logger.log(`FINAL TITLE: ${finalTitle}`);
            this.logger.log(`FINAL URL: ${finalUrl}`);

            if (this.isAntiBotPage(html)) {
                await page.screenshot({
                    path: '/tmp/antibot-debug.png',
                    fullPage: true,
                });

                throw new Error('Challenge anti-bot non résolu');
            }

            await page.screenshot({
                path: '/tmp/scrape-debug.png',
                fullPage: true,
            });

            return {
                ...(await this.extractMetadata(html, url)),
                source: 'playwright' as const,
            };
        } finally {
            await context.close();
        }
    }

    private isAntiBotPage(html: string): boolean {
        const content = html.toLowerCase();

        return (
            content.includes('captcha-delivery.com') ||
            content.includes('datadome') ||
            content.includes('just a moment') ||
            content.includes('enable javascript and cookies')
        );
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

        const scriptText: string[] = [];
        const scriptObjects: any[] = [];

        $('script').each((_, element) => {
            const content = $(element).html();

            if (!content) {
                return;
            }

            // Conserve tous les scripts pour le fallback fullText
            scriptText.push(content);

            // Essaie de parser les scripts JSON
            try {
                const parsed = JSON.parse(content);
                scriptObjects.push(parsed);
            } catch {
                // Script non JSON, on ignore
            }
        });

        const fullText = `
        ${title}
        ${description}
        ${$('title').text()}
        ${$('meta[property="og:title"]').attr('content') ?? ''}
        ${$('meta[property="og:description"]').attr('content') ?? ''}
        ${$('body').text()}
        ${scriptText.join('\n')}
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

        // --------------------------------------------------
        // ENERGY : DPE / GES
        // --------------------------------------------------

        let dpe: string | undefined;
        let ges: string | undefined;

        // --------------------------------------------------
        // 1. PRIMARY : JSON OBJECTS
        // --------------------------------------------------

        for (const data of scriptObjects) {
            const jsonString = JSON.stringify(data);

            if (
                jsonString.includes('fr_energy_after_2021') ||
                jsonString.includes('fr_ghg_after_2021') ||
                jsonString.includes('efficiencyclass') ||
                jsonString.includes('"dpe"') ||
                jsonString.includes('"ges"')
            ) {
                console.log('🔥🔥 ENERGY JSON TROUVÉ 🔥🔥');
                console.log(jsonString.substring(0, 10000));
            }

            const energy = this.extractEnergyFromObject(data);

            if (!dpe && energy.dpe) {
                dpe = energy.dpe;
            }

            if (!ges && energy.ges) {
                ges = energy.ges;
            }

            if (dpe && ges) {
                break;
            }
        }

        // --------------------------------------------------
        // 2. HTML STRUCTURÉ
        // L'adresse : .dpe.dpe-c / .ges.ges-a
        // --------------------------------------------------

        if (!dpe || !ges) {
            const htmlEnergy = this.extractEnergyFromHtml($);

            if (!dpe && htmlEnergy.dpe) {
                dpe = htmlEnergy.dpe;
            }

            if (!ges && htmlEnergy.ges) {
                ges = htmlEnergy.ges;
            }

            console.log('🔥 HTML ENERGY');
            console.log('🔥 DPE:', htmlEnergy.dpe ?? 'NON TROUVÉ');
            console.log('🔥 GES:', htmlEnergy.ges ?? 'NON TROUVÉ');
        }

        // --------------------------------------------------
        // 3. FALLBACK : FULL TEXT
        // --------------------------------------------------

        if (!dpe || !ges) {
            const fallbackEnergy = this.extractEnergyRatings(fullText);

            if (!dpe && fallbackEnergy.dpe) {
                dpe = fallbackEnergy.dpe;
            }

            if (!ges && fallbackEnergy.ges) {
                ges = fallbackEnergy.ges;
            }
        }

        // --------------------------------------------------
        // 4. FINAL VALIDATION
        // --------------------------------------------------

        dpe = this.normalizeEnergyRating(dpe);
        ges = this.normalizeEnergyRating(ges);

        // --------------------------------------------------
        // DEBUG
        // --------------------------------------------------

        console.log('----------------------------------------');
        console.log('🔥 ENERGY EXTRACTION');
        console.log('🔥 DPE EXTRAIT :', dpe ?? 'NON TROUVÉ');
        console.log('🔥 GES EXTRAIT :', ges ?? 'NON TROUVÉ');
        console.log('🔥 JSON OBJECTS :', scriptObjects.length);
        console.log('----------------------------------------');

        const location = await this.extractLocation({
            listing,
            title,
            description,
            url,
        });
        console.log('========================================');
        console.log('🔥 AVANT OPENAI ENERGY');
        console.log('🔥 DPE:', dpe);
        console.log('🔥 GES:', ges);
        console.log('========================================');

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
                dpe,
                ges,

                propertyFeatures,

                price,
            },
        });

        console.log('========================================');
        console.log('🔥 APRÈS OPENAI ENERGY');
        console.log('🔥 VERIFIED DPE:', verified.dpe);
        console.log('🔥 VERIFIED GES:', verified.ges);
        console.log('🔥 ORIGINAL DPE:', dpe);
        console.log('🔥 ORIGINAL GES:', ges);
        console.log('========================================');
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
            dpe: verified.dpe ?? dpe,
            ges: verified.ges ?? ges,

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
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                ],
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

    private extractEnergyFromHtml($: CheerioAPI) {
        let dpe: string | undefined;
        let ges: string | undefined;

        // ==================================================
        // 1. LADRESSE
        // .dpe.dpe-c
        // .ges.ges-a
        // ==================================================

        const dpeElement = $('.dpe[class*="dpe-"]').first();

        if (dpeElement.length) {
            const classes = dpeElement.attr('class') ?? '';

            const match = classes.match(/\bdpe-([a-g])\b/i);

            if (match?.[1]) {
                dpe = this.normalizeEnergyRating(match[1]);
            }
        }

        const gesElement = $('.ges[class*="ges-"]').first();

        if (gesElement.length) {
            const classes = gesElement.attr('class') ?? '';

            const match = classes.match(/\bges-([a-g])\b/i);

            if (match?.[1]) {
                ges = this.normalizeEnergyRating(match[1]);
            }
        }

        // ==================================================
        // 2. PAP
        // .energy-indice li.active
        // .ges-indice li.active
        // ==================================================

        if (!dpe) {
            const activeDpe = $('.energy-indice li.active').first().text().trim();

            dpe = this.normalizeEnergyRating(activeDpe);
        }

        if (!ges) {
            const activeGes = $('.ges-indice li.active').first().text().trim();

            ges = this.normalizeEnergyRating(activeGes);
        }

        // ==================================================
        // 3. ORPI - DPE
        // ==================================================

        if (!dpe) {
            $('ul.c-dpe').each((_, element) => {
                if (dpe) {
                    return;
                }

                // On exclut explicitement le bloc GES
                if ($(element).hasClass('c-dpe--ges')) {
                    return;
                }

                const active = $(element)
                    .find('li')
                    .filter((_, li) => {
                        const className = $(li).attr('class') ?? '';
                        return className.includes('c-dpe__index--active');
                    })
                    .first();

                const text = active.clone().children().remove().end().text().trim();

                const rating = this.normalizeEnergyRating(text.charAt(0));

                console.log('🔥 ORPI DPE HTML TEXT:', text);
                console.log('🔥 ORPI DPE HTML RATING:', rating);

                if (rating) {
                    dpe = rating;
                }
            });
        }

        // ==================================================
        // ORPI - GES
        // ==================================================

        if (!ges) {
            $('ul.c-dpe--ges').each((_, element) => {
                if (ges) {
                    return;
                }

                const active = $(element)
                    .find('li')
                    .filter((_, li) => {
                        const className = $(li).attr('class') ?? '';
                        return className.includes('c-dpe__index--active');
                    })
                    .first();

                const text = active.clone().children().remove().end().text().trim();

                const rating = this.normalizeEnergyRating(text.charAt(0));

                console.log('🔥 ORPI GES HTML TEXT:', text);
                console.log('🔥 ORPI GES HTML RATING:', rating);

                if (rating) {
                    ges = rating;
                }
            });
        }

        /// ============================================================
        // CENTURY 21 — DPE
        // ============================================================

        const centuryDpeSvg = $('.c-the-dpe-ges-new-dpe-svg svg').first();

        if (!dpe && centuryDpeSvg.length) {
            console.log('🔥 CENTURY 21 DPE SVG FOUND');

            const dpeColors: Record<string, string> = {
                '#00a06d': 'A',
                '#52b153': 'B',
                '#a5cc74': 'C',
                '#f4e70f': 'D',
                '#f0b40f': 'E',
                '#eb8235': 'F',
                '#d7221f': 'G',
            };

            // --------------------------------------------------------
            // Valeur numérique
            // --------------------------------------------------------

            let dpeValue: number | undefined;

            centuryDpeSvg.find('g[data-name="labelsetchiffres"] g[data-name="chiffres"] text').each((_, element) => {
                const text = $(element).text().trim();

                const value = Number(text.replace(/\s/g, '').replace(',', '.'));

                if (Number.isFinite(value) && dpeValue === undefined) {
                    dpeValue = value;
                }
            });

            // --------------------------------------------------------
            // Classe DPE
            // --------------------------------------------------------

            let detectedDpe: string | undefined;

            centuryDpeSvg.find('path').each((_, element) => {
                if (detectedDpe) {
                    return;
                }

                const style = ($(element).attr('style') ?? '').toLowerCase();

                const fillMatch = style.match(/fill\s*:\s*(#[0-9a-f]{6})/i);

                if (!fillMatch) {
                    return;
                }

                const color = fillMatch[1].toLowerCase();

                const candidate = dpeColors[color];

                if (!candidate) {
                    return;
                }

                /*
                 * On cherche si ce path coloré possède un contour noir
                 * correspondant à la classe sélectionnée.
                 *
                 * Pour éviter de prendre tous les chemins internes,
                 * on regarde les paths ayant une géométrie de grande taille.
                 */

                const d = $(element).attr('d') ?? '';

                if (d.length > 40) {
                    // Pour l'instant on garde le candidat.
                    // La validation par géométrie sera faite ci-dessous.
                }
            });

            // --------------------------------------------------------
            // Détection fiable de la classe active
            // --------------------------------------------------------

            const selectedRanges = [
                { rating: 'A', minY: 0, maxY: 39 },
                { rating: 'B', minY: 39, maxY: 68 },
                { rating: 'C', minY: 68, maxY: 120 },
                { rating: 'D', minY: 120, maxY: 149 },
                { rating: 'E', minY: 149, maxY: 178 },
                { rating: 'F', minY: 178, maxY: 207 },
                { rating: 'G', minY: 207, maxY: 240 },
            ];

            /*
             * Le contour noir de la sélection est un path dont le d
             * contient la zone de la ligne sélectionnée.
             */

            centuryDpeSvg.find('path').each((_, element) => {
                if (detectedDpe) {
                    return;
                }

                const style = ($(element).attr('style') ?? '').toLowerCase();

                if (!style.includes('fill:#1d1d1b')) {
                    return;
                }

                const d = $(element).attr('d') ?? '';

                /*
                 * On extrait les coordonnées Y présentes dans le path.
                 */
                const yValues = [...d.matchAll(/(?:^|[A-Za-z])[-\d.]+(?:\s+)([-\d.]+)/g)]
                    .map((match) => Number(match[1]))
                    .filter(Number.isFinite);

                if (!yValues.length) {
                    return;
                }

                const minY = Math.min(...yValues);
                const maxY = Math.max(...yValues);

                const selected = selectedRanges.find((range) => minY >= range.minY && minY <= range.maxY);

                if (selected) {
                    detectedDpe = selected.rating;

                    console.log('🔥 CENTURY 21 DPE SELECTED:', detectedDpe, `Y=${minY}-${maxY}`);
                }
            });

            if (detectedDpe) {
                dpe = detectedDpe;
            }

            console.log('🔥 CENTURY 21 DPE FINAL:', dpe, 'VALUE:', dpeValue);
        }

        // ============================================================
        // CENTURY 21 — GES
        // ============================================================

        const centuryGesSvg = $('.c-the-dpe-ges-new-ges-svg svg').first();

        if (!ges && centuryGesSvg.length) {
            console.log('🔥 CENTURY 21 GES SVG FOUND');

            interface SvgText {
                text: string;
                x: number;
                y: number;
            }

            const texts: SvgText[] = [];

            centuryGesSvg.find('text').each((_, element) => {
                const text = $(element).text().trim();

                const transform = $(element).attr('transform') ?? '';

                const match = transform.match(/translate\(\s*([\d.-]+)[,\s]+([\d.-]+)\s*\)/i);

                if (!match) {
                    return;
                }

                const x = Number(match[1]);
                const y = Number(match[2]);

                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                    return;
                }

                texts.push({
                    text,
                    x,
                    y,
                });
            });

            console.log('🔥 CENTURY 21 GES SVG TEXTS:', texts);

            /*
             * On cherche le label :
             *
             * kgCO
             *  2
             * /m
             *  2
             * .an
             *
             * puis la valeur placée juste à gauche.
             */

            const unitText = texts.find((t) => t.text.replace(/\s/g, '').toLowerCase().includes('kgco'));

            console.log('🔥 CENTURY 21 GES UNIT:', unitText);

            let gesValue: number | undefined;

            if (unitText) {
                const candidates = texts
                    .map((t) => ({
                        ...t,
                        value: Number(t.text.replace(/\s/g, '').replace(',', '.')),
                    }))
                    .filter((t) => Number.isFinite(t.value) && t.x < unitText.x && Math.abs(t.y - unitText.y) <= 15)
                    .sort((a, b) => {
                        const distanceA = Math.abs(unitText.x - a.x) + Math.abs(unitText.y - a.y);

                        const distanceB = Math.abs(unitText.x - b.x) + Math.abs(unitText.y - b.y);

                        return distanceA - distanceB;
                    });

                if (candidates.length > 0) {
                    gesValue = candidates[0].value;

                    console.log(
                        '🔥 CENTURY 21 GES NUMERIC VALUE:',
                        gesValue,
                        `(${candidates[0].x}, ${candidates[0].y})`,
                    );
                }
            }

            console.log('🔥 CENTURY 21 GES VALUE:', gesValue);

            if (gesValue !== undefined) {
                if (gesValue <= 6) {
                    ges = 'A';
                } else if (gesValue <= 10) {
                    ges = 'B';
                } else if (gesValue <= 30) {
                    ges = 'C';
                } else if (gesValue <= 50) {
                    ges = 'D';
                } else if (gesValue <= 70) {
                    ges = 'E';
                } else if (gesValue <= 100) {
                    ges = 'F';
                } else {
                    ges = 'G';
                }

                console.log('🔥 CENTURY 21 GES FINAL:', ges, 'FROM:', gesValue, 'kgCO₂/m²/an');
            }
        }

        // ==========================================================
        // FIGARO IMMOBILIER — DPE / GES
        // ==========================================================

        if (!dpe) {
            const activeDpe = $('.classified-dpe__dpe-ges .container-dpe .dpe-list li.active').first();

            if (activeDpe.length) {
                const classes = activeDpe.attr('class') ?? '';

                const match = classes.match(/\bdpe-([a-g])\b/i);

                if (match) {
                    dpe = match[1].toUpperCase();

                    console.log('🔥 FIGARO DPE FOUND:', dpe);
                }
            }
        }

        if (!ges) {
            const activeGes = $('.classified-dpe__dpe-ges .container-ges .ges-list li.active').first();

            if (activeGes.length) {
                const classes = activeGes.attr('class') ?? '';

                const match = classes.match(/\bges-([a-g])\b/i);

                if (match) {
                    ges = match[1].toUpperCase();

                    console.log('🔥 FIGARO GES FOUND:', ges);
                }
            }
        }

        // ==========================================================
        // PARU VENDU — DPE / GES
        // ==========================================================
        //
        // Exemple :
        //
        // DPE
        // <div class="DPE_consEnerNote NoteEnerg_D">D</div>
        //
        // GES
        // <div class="DPE_effSerreNote NoteGES2022_D">D</div>
        //
        // IMPORTANT :
        // On récupère directement la classe énergétique affichée.
        // ==========================================================

        // ----------------------------------------------------------
        // PARU VENDU — DPE
        // ----------------------------------------------------------

        if (!dpe) {
            const paruVenduDpe = $('.DPE_consEnerNote').first();

            if (paruVenduDpe.length) {
                const classes = paruVenduDpe.attr('class') ?? '';

                const match = classes.match(/\bNoteEnerg_([A-G])\b/i);

                if (match?.[1]) {
                    dpe = this.normalizeEnergyRating(match[1]);

                    console.log('🔥 PARU VENDU DPE:', dpe, 'classes:', classes);
                }
            }
        }

        // ----------------------------------------------------------
        // PARU VENDU — GES
        // ----------------------------------------------------------

        if (!ges) {
            const paruVenduGes = $('.DPE_effSerreNote').first();

            if (paruVenduGes.length) {
                const classes = paruVenduGes.attr('class') ?? '';

                const match = classes.match(/\bNoteGES2022_([A-G])\b/i);

                if (match?.[1]) {
                    ges = this.normalizeEnergyRating(match[1]);

                    console.log('🔥 PARU VENDU GES:', ges, 'classes:', classes);
                }
            }
        }

        return {
            dpe,
            ges,
        };
    }

    /**
     * Normalise et valide une classe énergétique.
     *
     * Seules les classes A à G sont acceptées.
     */
    private normalizeEnergyRating(value: any): string | undefined {
        if (value === null || value === undefined) {
            return undefined;
        }

        const rating = String(value).trim().toUpperCase();

        return /^[A-G]$/.test(rating) ? rating : undefined;
    }

    /**
     * Extrait DPE / GES depuis un objet JSON.
     *
     * Recherche récursive avec conservation du chemin complet.
     *
     * Exemples supportés :
     * - fr_energy_after_2021
     * - fr_ghg_after_2021
     * - energy
     * - dpe
     * - ges
     * - ghg
     * - efficiencyclass.rating
     * - efficiencyClass.rating
     * - rating
     */
    private extractEnergyFromObject(data: any) {
        let dpe: string | undefined;
        let ges: string | undefined;

        const visit = (obj: any, path: string[] = []) => {
            if (obj === null || obj === undefined) {
                return;
            }

            if (typeof obj !== 'object') {
                return;
            }

            const currentPath = path.join('.').toLowerCase();

            // ==================================================
            // 1. DÉTECTION DU TYPE
            // ==================================================

            const type = typeof obj.type === 'string' ? obj.type.toLowerCase() : '';

            const id = typeof obj.id === 'string' ? obj.id.toLowerCase() : '';

            const name = typeof obj.name === 'string' ? obj.name.toLowerCase() : '';

            const semanticPath = `${currentPath}.${type}.${id}.${name}`;

            // ==================================================
            // 2. RECHERCHE DE RATING
            // ==================================================

            const possibleRatings = [
                obj.rating,
                obj.efficiencyclass?.rating,
                obj.efficiencyClass?.rating,
                obj.value,
                obj.class,
                obj.energyClass,
                obj.energy_class,
                obj.dpe,
                obj.ges,
            ];

            for (const value of possibleRatings) {
                const rating = this.normalizeEnergyRating(value);

                if (!rating) {
                    continue;
                }

                // ------------------------------
                // DPE
                // ------------------------------

                if (
                    semanticPath.includes('energy') ||
                    semanticPath.includes('dpe') ||
                    semanticPath.includes('efficiency')
                ) {
                    if (!dpe) {
                        dpe = rating;

                        console.log('🔥 DPE TROUVÉ JSON:', {
                            rating,
                            path: semanticPath,
                        });
                    }
                }

                // ------------------------------
                // GES
                // ------------------------------

                if (
                    semanticPath.includes('ghg') ||
                    semanticPath.includes('ges') ||
                    semanticPath.includes('greenhouse') ||
                    semanticPath.includes('climate')
                ) {
                    if (!ges) {
                        ges = rating;

                        console.log('🔥 GES TROUVÉ JSON:', {
                            rating,
                            path: semanticPath,
                        });
                    }
                }
            }

            // ==================================================
            // 3. CLÉS EXPLICITES
            // ==================================================

            for (const [key, value] of Object.entries(obj)) {
                const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');

                // ----------------------------------------------
                // DPE
                // ----------------------------------------------

                if (
                    normalizedKey.includes('frenergyafter2021') ||
                    normalizedKey === 'dpe' ||
                    normalizedKey.includes('energyclass') ||
                    normalizedKey.includes('energyclassification')
                ) {
                    const rating = this.extractRatingValue(value);

                    if (rating && !dpe) {
                        dpe = rating;

                        console.log('🔥 DPE TROUVÉ PAR CLÉ:', {
                            key,
                            rating,
                        });
                    }
                }

                // ----------------------------------------------
                // GES
                // ----------------------------------------------

                if (
                    normalizedKey.includes('frghgafter2021') ||
                    normalizedKey === 'ges' ||
                    normalizedKey.includes('ghg') ||
                    normalizedKey.includes('greenhouse')
                ) {
                    const rating = this.extractRatingValue(value);

                    if (rating && !ges) {
                        ges = rating;

                        console.log('🔥 GES TROUVÉ PAR CLÉ:', {
                            key,
                            rating,
                        });
                    }
                }

                // ----------------------------------------------
                // RECURSION
                // ----------------------------------------------

                if (value !== null && typeof value === 'object') {
                    visit(value, [...path, key]);
                }
            }
        };

        visit(data);

        return {
            dpe,
            ges,
        };
    }

    /**
     * Extrait une classe A-G depuis une structure quelconque.
     */
    private extractRatingValue(value: any): string | undefined {
        if (value === null || value === undefined) {
            return undefined;
        }

        // Valeur directe
        const direct = this.normalizeEnergyRating(value);

        if (direct) {
            return direct;
        }

        // Objet
        if (typeof value === 'object') {
            const candidates = [
                value.rating,
                value.Rating,
                value.value,
                value.Value,
                value.class,
                value.Class,
                value.energyClass,
                value.energy_class,
                value.label,
            ];

            for (const candidate of candidates) {
                const rating = this.normalizeEnergyRating(candidate);

                if (rating) {
                    return rating;
                }
            }
        }

        return undefined;
    }

    /**
     * Fallback DPE / GES depuis le texte.
     */
    private extractEnergyRatings(text: string) {
        const normalized = text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ');

        let dpe: string | undefined;
        let ges: string | undefined;

        // ==================================================
        // 1. DPE EXPLICITE
        // ==================================================

        const dpePatterns = [
            /\bdpe\s*[:\-]?\s*([a-g])\b/i,

            /\bclasse\s+(?:energetique|energie)\s*[:\-]?\s*([a-g])\b/i,

            /\bperformance\s+energetique\s*[:\-]?\s*([a-g])\b/i,

            /\bdiagnostic\s+de\s+performance\s+energetique\s*[:\-]?\s*([a-g])\b/i,

            /\bconsommation\s+energetique\s*[:\-]?\s*([a-g])\b/i,
        ];

        for (const pattern of dpePatterns) {
            const match = normalized.match(pattern);

            if (match?.[1]) {
                dpe = this.normalizeEnergyRating(match[1]);

                if (dpe) {
                    console.log('🔥 DPE TROUVÉ TEXTE:', dpe);
                    break;
                }
            }
        }

        // ==================================================
        // 2. GES EXPLICITE
        // ==================================================

        const gesPatterns = [
            /\bges\s*[:\-]?\s*([a-g])\b/i,

            /\bclasse\s+climat\s*[:\-]?\s*([a-g])\b/i,

            /\bemissions?\s+(?:de\s+)?gaz\s+a\s+effet\s+de\s+serre\s*[:\-]?\s*([a-g])\b/i,

            /\bemissions?\s+de\s+co2\s*[:\-]?\s*([a-g])\b/i,

            /\bgaz\s+a\s+effet\s+de\s+serre\s*[:\-]?\s*([a-g])\b/i,
        ];

        for (const pattern of gesPatterns) {
            const match = normalized.match(pattern);

            if (match?.[1]) {
                ges = this.normalizeEnergyRating(match[1]);

                if (ges) {
                    console.log('🔥 GES TROUVÉ TEXTE:', ges);
                    break;
                }
            }
        }

        // ==================================================
        // 3. STRUCTURES JSON DANS LE TEXTE
        // ==================================================

        if (!dpe) {
            const dpeJsonPatterns = [
                /fr[_\\]?energy[_\\]?after[_\\]?2021[\s\S]{0,500}?(?:rating|value|class)["']?\s*[:=]\s*["']?([a-g])\b/i,

                /(?:dpe|energyclass|energy_class)[\s\S]{0,300}?(?:rating|value|class)["']?\s*[:=]\s*["']?([a-g])\b/i,
            ];

            for (const pattern of dpeJsonPatterns) {
                const match = normalized.match(pattern);

                if (match?.[1]) {
                    dpe = this.normalizeEnergyRating(match[1]);

                    if (dpe) {
                        console.log('🔥 DPE TROUVÉ JSON TEXT:', dpe);
                        break;
                    }
                }
            }
        }

        if (!ges) {
            const gesJsonPatterns = [
                /fr[_\\]?ghg[_\\]?after[_\\]?2021[\s\S]{0,500}?(?:rating|value|class)["']?\s*[:=]\s*["']?([a-g])\b/i,

                /(?:ges|ghg|greenhouse)[\s\S]{0,300}?(?:rating|value|class)["']?\s*[:=]\s*["']?([a-g])\b/i,
            ];

            for (const pattern of gesJsonPatterns) {
                const match = normalized.match(pattern);

                if (match?.[1]) {
                    ges = this.normalizeEnergyRating(match[1]);

                    if (ges) {
                        console.log('🔥 GES TROUVÉ JSON TEXT:', ges);
                        break;
                    }
                }
            }
        }

        console.log('🔥 FALLBACK ENERGY TEXT');
        console.log('🔥 DPE:', dpe ?? 'NON TROUVÉ');
        console.log('🔥 GES:', ges ?? 'NON TROUVÉ');

        return {
            dpe,
            ges,
        };
    }
}
