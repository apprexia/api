import { Injectable, Logger, BadRequestException } from '@nestjs/common';

import axios, { AxiosError, AxiosInstance } from 'axios';

import { FirecrawlListingMetadata, FirecrawlResponse } from './interfaces/firecrawl-listing-metadata.interface';

import { ListingMetadata } from '../meta-data-scrapper/interfaces/listing-metadata.interface';
import { PropertyFeatures } from '../meta-data-scrapper/interfaces/property-features.interface';
import { OpenaiService } from '../services/openai/openai.service';

@Injectable()
export class FirecrawlScraperService {
    private readonly logger = new Logger(FirecrawlScraperService.name);

    private readonly client: AxiosInstance;

    private readonly supportedPlatforms = ['leboncoin.fr', 'seloger.com', 'logic-immo.com'];

    constructor(private readonly openAiService: OpenaiService) {
        const apiKey = process.env.FIRECRAWL_API_KEY;

        if (!apiKey) {
            this.logger.warn('⚠️ FIRECRAWL_API_KEY non définie');
        }

        this.client = axios.create({
            baseURL: 'https://api.firecrawl.dev/v2',
            timeout: 45_000,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    // =========================================================================
    // PLATFORM
    // =========================================================================

    /**
     * Vérifie si l'URL appartient à une plateforme supportée.
     */
    supports(url: string): boolean {
        try {
            const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');

            return this.supportedPlatforms.some(
                (platform) => hostname === platform || hostname.endsWith(`.${platform}`),
            );
        } catch {
            return false;
        }
    }

    /**
     * Retourne le nom de la plateforme.
     */
    private getPlatform(url: string): 'leboncoin' | 'seloger' | 'logic-immo' | undefined {
        try {
            const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');

            if (hostname === 'leboncoin.fr' || hostname.endsWith('.leboncoin.fr')) {
                return 'leboncoin';
            }

            if (hostname === 'seloger.com' || hostname.endsWith('.seloger.com')) {
                return 'seloger';
            }

            if (hostname === 'logic-immo.com' || hostname.endsWith('.logic-immo.com')) {
                return 'logic-immo';
            }

            return undefined;
        } catch {
            return undefined;
        }
    }

    // =========================================================================
    // SCRAPE
    // =========================================================================

    /**
     * Scrape une annonce immobilière via Firecrawl.
     *
     * Firecrawl récupère la page.
     * Les données sont ensuite extraites par les règles déterministes
     * puis vérifiées par OpenAI.
     */
    async scrape(url: string): Promise<ListingMetadata> {
        if (!this.supports(url)) {
            throw new BadRequestException(`Plateforme non supportée par Firecrawl : ${url}`);
        }

        const platform = this.getPlatform(url);

        this.logger.log(`🔥 Firecrawl [${platform ?? 'unknown'}] → ${url}`);

        const start = Date.now();

        try {
            const response = await this.client.post<FirecrawlResponse>('/scrape', {
                url,
                formats: ['markdown'],
                onlyMainContent: true,
                waitFor: 3000,
            });

            const elapsed = Date.now() - start;

            this.logger.log(`🔥 Firecrawl terminé en ${elapsed} ms`);

            const result = response.data;

            if (!result?.success) {
                throw new Error(result?.error || 'Firecrawl a retourné success=false');
            }

            const markdown = result?.data?.markdown || '';

            if (!markdown.trim()) {
                throw new Error('Firecrawl n’a retourné aucun markdown');
            }

            this.logger.log(`🔥 Markdown récupéré : ${markdown.length} caractères`);

            // -------------------------------------------------------------
            // Challenge DataDome / captcha
            // -------------------------------------------------------------

            const challengeDetected = this.containsChallenge(markdown);

            if (challengeDetected) {
                this.logger.warn(`⚠️ Challenge détecté dans la réponse Firecrawl [${platform}]`);
            }

            // -------------------------------------------------------------
            // Extraction déterministe
            // -------------------------------------------------------------

            const metadata = this.extractMetadata(markdown, result?.data?.metadata, url, platform);

            // -------------------------------------------------------------
            // Vérification / enrichissement OpenAI
            // -------------------------------------------------------------

            const verified = await this.openAiService.verifyExtractedMetadata({
                url,

                title: metadata.title ?? '',

                description: metadata.description ?? '',

                body: markdown,

                extracted: {
                    address: metadata.address,

                    streetAddress: metadata.streetAddress,

                    city: metadata.city,

                    codePostal: metadata.codePostal,

                    typeLocal: metadata.typeLocal,

                    surface: metadata.surface,

                    terrain: metadata.terrain,

                    rooms: metadata.rooms,

                    dpe: metadata.dpe,

                    ges: metadata.ges,

                    propertyFeatures: metadata.propertyFeatures,

                    price: metadata.price,
                },
            });

            this.logger.log(`🤖 Métadonnées vérifiées par OpenAI : ${JSON.stringify(verified, null, 2)}`);

            // -------------------------------------------------------------
            // Résultat final
            // -------------------------------------------------------------

            return {
                ...metadata,

                address: verified.address ?? metadata.address,

                streetAddress: verified.streetAddress ?? metadata.streetAddress,

                city: verified.city ?? metadata.city,

                codePostal: verified.codePostal ?? metadata.codePostal,

                typeLocal: verified.typeLocal ?? metadata.typeLocal,

                propertyCondition: verified.propertyCondition ?? metadata.propertyCondition,

                surface: verified.surface ?? metadata.surface,

                terrain: verified.terrain ?? metadata.terrain,

                rooms: verified.rooms ?? metadata.rooms,

                dpe: verified.dpe ?? metadata.dpe,

                ges: verified.ges ?? metadata.ges,

                propertyFeatures: verified.propertyFeatures ?? metadata.propertyFeatures,

                price: verified.price ?? metadata.price,
            };
        } catch (error: unknown) {
            const elapsed = Date.now() - start;

            this.logger.error(`❌ Firecrawl échec après ${elapsed} ms`);

            this.logAxiosError(error);

            throw error;
        }
    }

    // =========================================================================
    // MAPPING
    // =========================================================================

    private mapToListingMetadata(data: FirecrawlListingMetadata, url: string): ListingMetadata {
        return this.removeUndefinedValues({
            source: 'firecrawl',

            url,

            title: data.title,

            description: data.description,

            price: data.price,

            currency: 'EUR',

            surface: data.surface,

            rooms: data.rooms,

            bedrooms: data.bedrooms,

            bathrooms: data.bathrooms,

            city: data.city,

            codePostal: data.codePostal,

            address: data.address,

            streetAddress: data.streetAddress,

            typeLocal: this.normalizePropertyType(data.typeLocal),

            propertyCondition: data.propertyCondition,

            dpe: data.dpe,

            ges: data.ges,

            images: data.images?.length ? data.images : data.imageUrl ? [data.imageUrl] : [],

            propertyFeatures: data.propertyFeatures,

            constructionYear: data.constructionYear,

            floor: data.floor ?? null,

            totalFloors: data.totalFloors,

            heatingType: data.heatingType,

            charges: data.charges,

            reference: data.reference,

            sellerName: data.sellerName,

            sellerSiret: data.sellerSiret,
        });
    }

    // =========================================================================
    // PROPERTY TYPE
    // =========================================================================

    private normalizePropertyType(type?: string): ListingMetadata['typeLocal'] {
        if (!type) {
            return 'Inconnu';
        }

        const value = type
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        if (value.includes('appartement') || value.includes('apartment') || value.includes('flat')) {
            return 'Appartement';
        }

        if (value.includes('maison') || value.includes('house') || value.includes('villa')) {
            return 'Maison';
        }

        if (value.includes('terrain')) {
            return 'Terrain';
        }

        if (value.includes('parking') || value.includes('garage')) {
            return 'Parking';
        }

        if (value.includes('local commercial') || value.includes('commerce')) {
            return 'Local commercial';
        }

        if (value.includes('immeuble')) {
            return 'Immeuble';
        }

        return 'Inconnu';
    }

    // =========================================================================
    // MARKDOWN
    // =========================================================================

    /**
     * Retourne uniquement le Markdown Firecrawl.
     */
    async scrapeMarkdown(url: string): Promise<string> {
        if (!this.supports(url)) {
            throw new BadRequestException(`Plateforme non supportée par Firecrawl : ${url}`);
        }

        const platform = this.getPlatform(url);

        this.logger.log(`🔥 Firecrawl Markdown [${platform ?? 'unknown'}] → ${url}`);

        const start = Date.now();

        try {
            const response = await this.client.post<FirecrawlResponse>('/scrape', {
                url,
                formats: ['markdown'],
                onlyMainContent: true,
                waitFor: 3000,
            });

            const elapsed = Date.now() - start;

            this.logger.log(`🔥 Firecrawl terminé en ${elapsed} ms`);

            if (!response.data?.success) {
                throw new Error(response.data?.error || 'Firecrawl a retourné success=false');
            }

            const markdown = response.data?.data?.markdown || '';

            if (!markdown.trim()) {
                throw new Error('Firecrawl n’a retourné aucun markdown');
            }

            return markdown;
        } catch (error: unknown) {
            const elapsed = Date.now() - start;

            this.logger.error(`❌ Firecrawl échec après ${elapsed} ms`);

            this.logAxiosError(error);

            throw error;
        }
    }

    // =========================================================================
    // CHALLENGE DETECTION
    // =========================================================================

    /**
     * Détecte DataDome et autres pages de blocage.
     *
     * Un challenge présent dans le Markdown ne signifie pas nécessairement
     * que l'annonce n'a pas également été récupérée.
     */
    private containsChallenge(markdown: string): boolean {
        const lower = markdown.toLowerCase();

        const indicators = [
            'vous avez été bloqué',
            'accès temporairement restreint',
            'pourquoi ce blocage',
            'captcha-delivery.com',
            'quelque chose dans le comportement',
            'accès refusé',
            'access denied',
            'captcha',
            'datadome',
        ];

        return indicators.some((indicator) => lower.includes(indicator));
    }

    // =========================================================================
    // METADATA
    // =========================================================================

    private extractMetadata(
        markdown: string,
        firecrawlMetadata: Record<string, any> | undefined,
        url: string,
        platform?: 'leboncoin' | 'seloger' | 'logic-immo',
    ): ListingMetadata {
        const text = this.normalizeMarkdown(markdown);

        const extracted: FirecrawlListingMetadata = {
            title: firecrawlMetadata?.title ?? this.extractTitle(markdown, platform),

            description: this.extractDescription(text, platform),

            price: firecrawlMetadata?.price ?? this.extractPrice(text, platform),

            surface: firecrawlMetadata?.surface ?? this.extractSurface(text, platform),

            rooms: firecrawlMetadata?.rooms ?? this.extractRooms(text, platform),

            bedrooms: firecrawlMetadata?.bedrooms ?? this.extractBedrooms(text),

            bathrooms: firecrawlMetadata?.bathrooms ?? this.extractBathrooms(text),

            city: firecrawlMetadata?.city ?? this.extractCity(text, platform),

            codePostal: firecrawlMetadata?.codePostal ?? this.extractPostalCode(text),

            address: firecrawlMetadata?.address,

            streetAddress: firecrawlMetadata?.streetAddress,

            typeLocal: firecrawlMetadata?.typeLocal ?? this.extractPropertyType(text, platform),

            dpe: firecrawlMetadata?.dpe ?? this.extractDpe(markdown, text, platform),

            ges: firecrawlMetadata?.ges ?? this.extractGes(markdown, text, platform),

            images: this.extractImages(markdown, platform, firecrawlMetadata),

            propertyFeatures: this.extractFeatures(text),

            propertyCondition: this.detectPropertyCondition(
                firecrawlMetadata?.title ?? this.extractTitle(markdown, platform) ?? '',
                this.extractDescription(text, platform) ?? '',
                text,
            ),

            constructionYear: firecrawlMetadata?.constructionYear ?? this.extractConstructionYear(text),

            floor: firecrawlMetadata?.floor ?? this.extractFloor(text),

            totalFloors: firecrawlMetadata?.totalFloors ?? this.extractTotalFloors(text),

            heatingType: firecrawlMetadata?.heatingType ?? this.extractHeating(text),

            charges: firecrawlMetadata?.charges ?? this.extractCharges(text),

            reference: firecrawlMetadata?.reference ?? this.extractReference(text),

            sellerName: firecrawlMetadata?.sellerName ?? this.extractSellerName(text),

            sellerSiret: firecrawlMetadata?.sellerSiret ?? this.extractSiret(text),
        };

        return this.mapToListingMetadata(this.removeUndefinedValues(extracted), url);
    }

    // =========================================================================
    // NORMALIZATION
    // =========================================================================

    private normalizeMarkdown(markdown: string): string {
        return (
            markdown

                // Images Markdown
                .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')

                // Liens Markdown
                .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')

                // Titres Markdown
                .replace(/^#{1,6}\s+/gm, '')

                // Entités / espaces
                .replace(/\u00A0/g, ' ')
                .replace(/\u202F/g, ' ')

                // Caractères invisibles
                .replace(/[\u200B-\u200D\uFEFF]/g, '')

                // Plusieurs espaces
                .replace(/\s+/g, ' ')

                .trim()
        );
    }

    // =========================================================================
    // TITLE
    // =========================================================================

    private extractTitle(markdown: string, platform?: 'leboncoin' | 'seloger' | 'logic-immo'): string | undefined {
        const h1 = markdown.match(/^#\s+(.+?)(?:\n|$)/m);

        if (h1?.[1]) {
            return this.cleanTitle(h1[1]);
        }

        const match = markdown.match(/(?:Appartement|Maison|Studio|Villa|Loft|Duplex|Terrain)[^\n]{0,150}/i);

        if (match?.[0]) {
            return this.cleanTitle(match[0]);
        }

        return undefined;
    }

    private cleanTitle(value: string): string {
        return value
            .replace(/^#{1,6}\s*/, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private detectPropertyCondition(
        title: string,
        description: string,
        fullText: string,
    ): 'NEUF' | 'ANCIEN' | 'INCONNU' {
        const normalize = (value: string) =>
            value
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();

        const titleText = normalize(title);
        const descriptionText = normalize(description);
        const text = normalize(fullText);

        // =====================================================
        // 1. SIGNAUX FORTS : NEUF
        // =====================================================

        const strongNewPatterns = [
            /\bappartement neuf\b/,
            /\bmaison neuve\b/,
            /\bbien neuf\b/,
            /\bprogramme neuf\b/,
            /\bprogramme immobilier neuf\b/,
            /\bimmobilier neuf\b/,
            /\bconstruction neuve\b/,
            /\bresidence neuve\b/,
            /\bnouvelle residence\b/,
            /\bvefa\b/,
            /\bvente en etat futur d achevement\b/,
            /\bvente en l etat futur d achevement\b/,
            /\blivraison prevue\b/,
            /\blivraison prochaine\b/,
            /\blivraison t[1-4]\b/,
        ];

        if (
            strongNewPatterns.some((pattern) => pattern.test(titleText)) ||
            strongNewPatterns.some((pattern) => pattern.test(descriptionText))
        ) {
            this.logger.log('🏗️ PROPERTY CONDITION → NEUF');

            return 'NEUF';
        }

        // =====================================================
        // 2. PROGRAMME IMMOBILIER / CONSTRUCTION
        // =====================================================

        const programPatterns = [
            /\bprogramme immobilier\b/,
            /\bprogramme immobilier neuf\b/,
            /\bcommercialisation\b.*\bneuf\b/,
            /\bachat dans le neuf\b/,
            /\bappartement en cours de construction\b/,
            /\bconstruction en cours\b/,
            /\bresidence en construction\b/,
        ];

        if (programPatterns.some((pattern) => pattern.test(text))) {
            this.logger.log('🏗️ PROPERTY CONDITION → NEUF (PROGRAMME)');

            return 'NEUF';
        }

        // =====================================================
        // 3. VEFA / LIVRAISON
        // =====================================================

        if (
            /\bvefa\b/.test(text) ||
            /\bvente en etat futur d achevement\b/.test(text) ||
            /\blivraison\s+(?:prevue\s+)?(?:en\s+)?20\d{2}\b/.test(text)
        ) {
            this.logger.log('🏗️ PROPERTY CONDITION → NEUF (VEFA/LIVRAISON)');

            return 'NEUF';
        }

        // =====================================================
        // 4. ANNÉE DE CONSTRUCTION TRÈS RÉCENTE
        // =====================================================

        const currentYear = new Date().getFullYear();

        const constructionPatterns = [
            /\b(?:construit|construction|livre|livree|acheve|achevee)\s+(?:en\s+)?(20\d{2})\b/g,
            /\b(?:construction|livraison)\s+(?:prevue\s+)?(?:en\s+)?(20\d{2})\b/g,
        ];

        for (const pattern of constructionPatterns) {
            const matches = [...text.matchAll(pattern)];

            for (const match of matches) {
                const year = Number(match[1]);

                if (!Number.isFinite(year)) {
                    continue;
                }

                if (year >= currentYear - 2) {
                    this.logger.log(`🏗️ PROPERTY CONDITION → NEUF (${year})`);

                    return 'NEUF';
                }
            }
        }

        // =====================================================
        // 5. ANCIEN EXPLICITE
        // =====================================================

        const oldPatterns = [
            /\bappartement ancien\b/,
            /\bmaison ancienne\b/,
            /\bbien ancien\b/,
            /\bimmeuble ancien\b/,
            /\bbatiment ancien\b/,
        ];

        if (oldPatterns.some((pattern) => pattern.test(text))) {
            this.logger.log('🏚️ PROPERTY CONDITION → ANCIEN');

            return 'ANCIEN';
        }

        // =====================================================
        // 6. RÉNOVÉ ≠ NEUF
        // =====================================================

        const renovationPatterns = [
            /\bentierement renove\b/,
            /\bentierement renovee\b/,
            /\brefait a neuf\b/,
            /\brenove recemment\b/,
            /\brenovation complete\b/,
            /\brenovation totale\b/,
            /\bentierement refait\b/,
        ];

        if (renovationPatterns.some((pattern) => pattern.test(text))) {
            this.logger.log('🔨 PROPERTY CONDITION → ANCIEN (RÉNOVÉ)');

            return 'ANCIEN';
        }

        // =====================================================
        // 7. INCONNU
        // =====================================================

        this.logger.log('❓ PROPERTY CONDITION → INCONNU');

        return 'INCONNU';
    }

    // =========================================================================
    // PRICE
    // =========================================================================

    private extractPrice(text: string, platform?: 'leboncoin' | 'seloger' | 'logic-immo'): number | undefined {
        const patterns: RegExp[] = [];

        if (platform === 'leboncoin') {
            patterns.push(
                /Prix du bien\s*(?:\(Honoraires inclus\))?\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,

                /Prix de vente\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,

                /Prix\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,
            );
        }

        if (platform === 'seloger') {
            patterns.push(
                /Maison à vendre\s*([\d\s.\u00A0\u202F]+)\s*€/i,

                /Appartement à vendre\s*([\d\s.\u00A0\u202F]+)\s*€/i,

                /Prix du bien\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,
            );
        }

        if (platform === 'logic-immo') {
            patterns.push(
                /Prix(?: de vente)?\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,

                /([\d\s.\u00A0\u202F]+)\s*€\s*(?:FAI|honoraires compris)/i,
            );
        }

        // -------------------------------------------------------------
        // Fallback commun
        // -------------------------------------------------------------

        patterns.push(
            /Prix du bien\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,

            /Prix de vente\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,

            /Prix\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,
        );

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            const price = Number(match[1].replace(/[^\d]/g, ''));

            if (price >= 10_000 && price <= 100_000_000) {
                return price;
            }
        }

        // -------------------------------------------------------------
        // Dernier fallback
        // -------------------------------------------------------------

        const generic = /([\d\s.\u00A0\u202F]{4,})\s*€/g;

        let match: RegExpExecArray | null;

        while ((match = generic.exec(text)) !== null) {
            const before = text.slice(Math.max(0, match.index - 100), match.index).toLowerCase();

            if (
                before.includes('/m²') ||
                before.includes('par m²') ||
                before.includes('mois') ||
                before.includes('intérêt') ||
                before.includes('notaire') ||
                before.includes('énergie') ||
                before.includes('facture')
            ) {
                continue;
            }

            const price = Number(match[1].replace(/[^\d]/g, ''));

            if (price >= 10_000 && price <= 100_000_000) {
                return price;
            }
        }

        return undefined;
    }

    // =========================================================================
    // SURFACE
    // =========================================================================

    private extractSurface(text: string, platform?: 'leboncoin' | 'seloger' | 'logic-immo'): number | undefined {
        const patterns = [
            /Surface habitable\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*m²/i,

            /Surface\s*(?:habitable)?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*m²/i,

            /(?:de|d'environ)\s*(\d+(?:[.,]\d+)?)\s*m²/i,

            /\b(\d+(?:[.,]\d+)?)\s*m²\b/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            const surface = Number(match[1].replace(',', '.'));

            if (surface > 5 && surface < 10_000) {
                return surface;
            }
        }

        return undefined;
    }

    // =========================================================================
    // ROOMS
    // =========================================================================

    private extractRooms(text: string, platform?: 'leboncoin' | 'seloger' | 'logic-immo'): number | undefined {
        const patterns = [
            /Nombre de pièces\s*[:\-]?\s*(\d+)/i,

            /(\d+)\s*Pièces?\s*[·•]\s*(?:\d+\s*)?(?:chambre|chambres)?/i,

            /\b(\d+)\s+Pièces?\s+\d+(?:[.,]\d+)?\s*m²/i,

            /\b(?:Appartement|Maison|Studio|Villa)\s+(\d+)\s+pièces?\b/i,

            /\bT(\d+)\b/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            const rooms = Number(match[1]);

            if (rooms >= 1 && rooms <= 30) {
                return rooms;
            }
        }

        return undefined;
    }

    // =========================================================================
    // BEDROOMS
    // =========================================================================

    private extractBedrooms(text: string): number | undefined {
        const patterns = [/Nombre de chambres\s*[:\-]?\s*(\d+)/i, /(\d+)\s*(?:chambre|chambres)\b/i, /(\d+)\s*ch\b/i];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            const bedrooms = Number(match[1]);

            if (bedrooms >= 0 && bedrooms <= 30) {
                return bedrooms;
            }
        }

        return undefined;
    }

    // =========================================================================
    // BATHROOMS
    // =========================================================================

    private extractBathrooms(text: string): number | undefined {
        const patterns = [
            /Nombre de salles?\s+de\s+bain\s*[:\-]?\s*(\d+)/i,

            /Nombre de salles?\s+d['’]eau\s*[:\-]?\s*(\d+)/i,

            /(\d+)\s+salles?\s+de\s+bain\b/i,

            /(\d+)\s+salles?\s+d['’]eau\b/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            const bathrooms = Number(match[1]);

            if (bathrooms >= 0 && bathrooms <= 20) {
                return bathrooms;
            }
        }

        return undefined;
    }

    // =========================================================================
    // POSTAL CODE
    // =========================================================================

    private extractPostalCode(text: string): string | undefined {
        const patterns = [/\b(\d{5})\b/];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            const cp = match[1];

            if (this.isValidFrenchPostalCode(cp)) {
                return cp;
            }
        }

        return undefined;
    }

    private isValidFrenchPostalCode(value: string): boolean {
        const number = Number(value);

        return number >= 1000 && number <= 95999;
    }

    // =========================================================================
    // CITY
    // =========================================================================

    private extractCity(text: string, platform?: 'leboncoin' | 'seloger' | 'logic-immo'): string | undefined {
        // Exemple :
        // Tours (37000)

        let match = text.match(/\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ .\-]{1,60})\s*\(\s*(\d{5})\s*\)/i);

        if (match?.[1]) {
            return this.cleanCity(match[1]);
        }

        // Exemple :
        // Tours 37000 · Quartier Centre-ville

        match = text.match(/\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ .\-]{1,60})\s+(\d{5})\s*(?:·|•|$)/i);

        if (match?.[1]) {
            return this.cleanCity(match[1]);
        }

        // Exemple :
        // Pointe Rouge, Marseille 8ème arrondissement (13008)

        match = text.match(
            /,\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ .\-]+?)\s+\d+(?:er|ère|ème|e)?\s+arrondissement\s*\(\s*\d{5}\s*\)/i,
        );

        if (match?.[1]) {
            return this.cleanCity(match[1]);
        }

        // Marseille 8ème arrondissement (13008)

        match = text.match(
            /\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ .\-]+?)\s+\d+(?:er|ère|ème|e)?\s+arrondissement\s*\(\s*\d{5}\s*\)/i,
        );

        if (match?.[1]) {
            return this.cleanCity(match[1]);
        }

        // Logic-Immo / SeLoger

        match = text.match(/(?:Ville|Localité|Commune)\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ .\-]{1,60})/i);

        if (match?.[1]) {
            return this.cleanCity(match[1]);
        }

        return undefined;
    }

    private cleanCity(value: string): string {
        return value
            .replace(/\s+/g, ' ')
            .replace(/\s+(?:·|•).*$/g, '')
            .replace(/\s+\d+(?:er|ère|ème|e)?\s+arrondissement.*$/i, '')
            .replace(/\s*\(\s*\d{5}\s*\).*$/, '')
            .trim();
    }

    // =========================================================================
    // PROPERTY TYPE
    // =========================================================================

    private extractPropertyType(text: string, platform?: 'leboncoin' | 'seloger' | 'logic-immo'): string | undefined {
        const explicit = text.match(
            /(?:Type de bien|Type du bien|Nature du bien|Type)\s*[:\-]?\s*(Appartement|Maison|Studio|Villa|Loft|Duplex|Château|Cabanon)\b/i,
        );

        if (explicit?.[1]) {
            return this.normalizePropertyType(explicit[1]);
        }

        if (/\bMaison\s+à\s+vendre\b/i.test(text)) {
            return 'Maison';
        }

        if (/\bAppartement\s+à\s+vendre\b/i.test(text)) {
            return 'Appartement';
        }

        if (/\bcabanon\b.*\busage d['’]habitation\b/i.test(text)) {
            return 'Maison';
        }

        if (/\bAppartement\b/i.test(text)) {
            return 'Appartement';
        }

        if (/\bMaison\b/i.test(text)) {
            return 'Maison';
        }

        if (/\bStudio\b/i.test(text)) {
            return 'Appartement';
        }

        if (/\bVilla\b/i.test(text)) {
            return 'Maison';
        }

        return undefined;
    }

    // =========================================================================
    // DPE
    // =========================================================================

    private extractDpe(
        markdown: string,
        text: string,
        platform?: 'leboncoin' | 'seloger' | 'logic-immo',
    ): string | undefined {
        const explicitPatterns = [
            /Classe énergie\s*[:\-]\s*([A-G])\b/i,

            /Classe énergétique\s*[:\-]\s*([A-G])\b/i,

            /DPE\s*[:\-]\s*([A-G])\b/i,

            /DPE\s*\(\s*([A-G])\s*\)/i,
        ];

        for (const pattern of explicitPatterns) {
            const match = text.match(pattern);

            if (match?.[1]) {
                return match[1].toUpperCase();
            }
        }

        const section = this.extractBetweenMarkers(
            markdown,
            ['Classe énergie', 'Diagnostic de performance énergétique', 'DPE'],
            ['GES', 'Indice d’émission', "Indice d'émission"],
        );

        if (section) {
            const values = section.match(/\b[A-G]\b/gi) ?? [];

            const unique = [...new Set(values.map((value) => value.toUpperCase()))];

            if (unique.length === 1) {
                return unique[0];
            }
        }

        return undefined;
    }

    // =========================================================================
    // GES
    // =========================================================================

    private extractGes(
        markdown: string,
        text: string,
        platform?: 'leboncoin' | 'seloger' | 'logic-immo',
    ): string | undefined {
        const explicitPatterns = [
            /Classe GES\s*[:\-]\s*([A-G])\b/i,

            /GES\s*[:\-]\s*([A-G])\b/i,

            /Émissions de GES\s*[:\-]\s*([A-G])\b/i,

            /Indice d['’]émission[^A-G]{0,40}\b([A-G])\b/i,
        ];

        for (const pattern of explicitPatterns) {
            const match = text.match(pattern);

            if (match?.[1]) {
                return match[1].toUpperCase();
            }
        }

        const section = this.extractBetweenMarkers(
            markdown,
            ['GES', 'Indice d’émission', "Indice d'émission"],
            ['Consommation', 'Estimation', 'Coût', 'Logement'],
        );

        if (section) {
            const values = section.match(/\b[A-G]\b/gi) ?? [];

            const unique = [...new Set(values.map((value) => value.toUpperCase()))];

            if (unique.length === 1) {
                return unique[0];
            }
        }

        return undefined;
    }

    // =========================================================================
    // DESCRIPTION
    // =========================================================================

    private extractDescription(text: string, platform?: 'leboncoin' | 'seloger' | 'logic-immo'): string | undefined {
        const patterns: RegExp[] = [];

        if (platform === 'leboncoin') {
            patterns.push(
                /Description\s+(.+?)(?=\s+Passer la liste des médias|\s+Coût du projet|\s+Vendu par|\s+Localisation)/i,
            );
        }

        if (platform === 'seloger') {
            patterns.push(
                /(?:Description|Cabanon à usage d'habitation)(.+?)(?=\s+Voir plus|\s+Caractéristiques|\s+Performance énergétique|\s+Plans du bien)/i,
            );
        }

        if (platform === 'logic-immo') {
            patterns.push(/Description\s+(.+?)(?=\s+Caractéristiques|\s+DPE|\s+Diagnostics|\s+Localisation)/i);
        }

        patterns.push(
            /Description\s+(.+?)(?=\s+Passer la liste des médias|\s+Coût du projet|\s+Vendu par|\s+Localisation|\s+Caractéristiques)/i,
        );

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            const description = match[1]
                .replace(/…\s*Voir plus.*$/i, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (description.length >= 20) {
                return description;
            }
        }

        return undefined;
    }

    // =========================================================================
    // IMAGES
    // =========================================================================

    private extractImages(
        markdown: string,
        platform?: 'leboncoin' | 'seloger' | 'logic-immo',
        metadata?: Record<string, any>,
    ): string[] {
        const urls: string[] = [];

        // -------------------------------------------------------------
        // 1. OG IMAGE = IMAGE PRINCIPALE
        // -------------------------------------------------------------

        const ogImage = metadata?.ogImage || metadata?.['og:image'] || metadata?.['twitter:image'];

        if (typeof ogImage === 'string' && ogImage.startsWith('http')) {
            urls.push(ogImage.trim());
        }

        // -------------------------------------------------------------
        // 2. IMAGES MARKDOWN
        // -------------------------------------------------------------

        const markdownRegex = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;

        let match: RegExpExecArray | null;

        while ((match = markdownRegex.exec(markdown)) !== null) {
            urls.push(match[1]);
        }

        // -------------------------------------------------------------
        // 3. URLS DIRECTES
        // -------------------------------------------------------------

        const directRegex = /https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi;

        while ((match = directRegex.exec(markdown)) !== null) {
            urls.push(match[0]);
        }

        // -------------------------------------------------------------
        // 4. FILTRE
        // -------------------------------------------------------------

        const filtered = urls.filter((url) => this.isPropertyImage(url, platform));

        return [...new Set(filtered.map((url) => url.trim()))];
    }

    // =========================================================================
    // PROPERTY IMAGE FILTER
    // =========================================================================

    private isPropertyImage(url: string, platform?: 'leboncoin' | 'seloger' | 'logic-immo'): boolean {
        const lower = url.toLowerCase();

        // -------------------------------------------------------------
        // LE BON COIN
        // -------------------------------------------------------------

        if (lower.includes('img.leboncoin.fr')) {
            return true;
        }

        // -------------------------------------------------------------
        // SELOGER
        // -------------------------------------------------------------

        if (lower.includes('mms.seloger.com')) {
            return true;
        }

        if (lower.includes('seloger.com') && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(lower)) {
            return true;
        }

        // -------------------------------------------------------------
        // LOGIC-IMMO
        // -------------------------------------------------------------

        if (lower.includes('logic-immo.com') && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(lower)) {
            return true;
        }

        // -------------------------------------------------------------
        // AUTRES CDN IMMOBILIERS
        // -------------------------------------------------------------

        if (lower.includes('property') || lower.includes('realestate') || lower.includes('annonce')) {
            return true;
        }

        return false;
    }

    // =========================================================================
    // CONSTRUCTION YEAR
    // =========================================================================

    private extractConstructionYear(text: string): number | undefined {
        const patterns = [
            /Année de construction\s*[:\-]?\s*(19\d{2}|20\d{2})/i,

            /Année\s*[:\-]?\s*(19\d{2}|20\d{2})/i,

            /Construit(?:e)?\s+en\s+(19\d{2}|20\d{2})/i,
        ];

        const currentYear = new Date().getFullYear();

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            const year = Number(match[1]);

            if (year >= 1700 && year <= currentYear) {
                return year;
            }
        }

        return undefined;
    }

    // =========================================================================
    // FLOOR
    // =========================================================================

    private extractFloor(text: string): number | undefined {
        const patterns = [
            /Étage de votre bien\s*[:\-]?\s*(-?\d+)/i,

            /Étage\s*[:\-]?\s*(-?\d+)/i,

            /(\d+)(?:er|ème|e)?\s+étage\b/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            return Number(match[1]);
        }

        // Rez-de-chaussée
        if (/\b(?:rez[- ]de[- ]chaussée|rdc)\b/i.test(text)) {
            return 0;
        }

        return undefined;
    }

    // =========================================================================
    // TOTAL FLOORS
    // =========================================================================

    private extractTotalFloors(text: string): number | undefined {
        const patterns = [
            /Nombre d['’]étages dans l['’]immeuble\s*[:\-]?\s*(\d+)/i,

            /Nombre d['’]étages\s*[:\-]?\s*(\d+)/i,

            /Immeuble de\s+(\d+)\s+étages?/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            const floors = Number(match[1]);

            if (floors >= 0 && floors <= 100) {
                return floors;
            }
        }

        return undefined;
    }

    // =========================================================================
    // HEATING
    // =========================================================================

    private extractHeating(text: string): string | undefined {
        const patterns = [
            /Mode de chauffage\s*[:\-]?\s*(.+?)(?=\s+(?:Étage|Nombre d’étages|Nombre d'|Exposition|Extérieur|Année|Disponible|Référence|Caractéristiques|Description)\b)/i,

            /Type de chauffage\s*[:\-]?\s*(.+?)(?=\s+(?:Mode|Étage|Exposition|Extérieur|Année|Disponible|Référence)\b)/i,

            /Chauffage\s*[:\-]?\s*(.+?)(?=\s+(?:Étage|Exposition|Extérieur|Année|Disponible|Référence)\b)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (match?.[1]?.trim()) {
                return match[1].trim();
            }
        }

        return undefined;
    }

    // =========================================================================
    // CHARGES
    // =========================================================================

    private extractCharges(text: string): number | undefined {
        const patterns = [
            /Charges annuelles de copropriété\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,

            /Charges annuelles\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,

            /Charges de copropriété\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            const charges = Number(match[1].replace(/[^\d]/g, ''));

            if (charges > 0) {
                return charges;
            }
        }

        return undefined;
    }

    // =========================================================================
    // REFERENCE
    // =========================================================================

    private extractReference(text: string): string | undefined {
        const patterns = [
            /Référence\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9_\-/.]+)/i,

            /Réf(?:érence)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9_\-/.]+)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (match?.[1]) {
                return match[1];
            }
        }

        return undefined;
    }

    // =========================================================================
    // SELLER
    // =========================================================================

    private extractSellerName(text: string): string | undefined {
        const patterns = [
            /Vendu par\s+(.+?)(?=\s+ProN°|\s+SIRET|\s+Dernière activité|\s+Suivre|\s+Les annonces)/i,

            /Publié par\s+(.+?)(?=\s+SIRET|\s+ProN°|\s+Suivre)/i,

            /Agence\s+(.+?)(?=\s+SIRET|\s+RCS|\s+Référence)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (match?.[1]?.trim()) {
                return match[1].trim();
            }
        }

        return undefined;
    }

    // =========================================================================
    // SIRET
    // =========================================================================

    private extractSiret(text: string): string | undefined {
        const siret = text.match(/SIRET\s*[:\-]?\s*(\d{14})/i);

        if (siret?.[1]) {
            return siret[1];
        }

        const siren = text.match(/SIREN\s*[:\-]?\s*(\d{9})/i);

        if (siren?.[1]) {
            return siren[1];
        }

        return undefined;
    }

    // =========================================================================
    // FEATURES
    // =========================================================================

    private extractFeatures(text: string): PropertyFeatures {
        const lower = text.toLowerCase();

        return {
            duplex: this.hasFeature(lower, ['duplex']),

            triplex: this.hasFeature(lower, ['triplex']),

            loft: this.hasFeature(lower, ['loft']),

            terrasse: this.hasFeature(lower, ['terrasse']),

            balcon: this.hasFeature(lower, ['balcon']),

            loggia: this.hasFeature(lower, ['loggia']),

            jardin: this.hasFeature(lower, ['jardin']),

            patio: this.hasFeature(lower, ['patio']),

            piscine: this.hasFeature(lower, ['piscine']),

            jacuzzi: this.hasFeature(lower, ['jacuzzi']),

            spa: this.hasFeature(lower, ['spa']),

            sauna: this.hasFeature(lower, ['sauna']),

            parking: this.hasFeature(lower, ['parking', 'place de parking', 'stationnement']),

            garage: this.hasFeature(lower, ['garage']),

            box: this.hasFeature(lower, ['box']),

            cave: this.hasFeature(lower, ['cave']),

            grenier: this.hasFeature(lower, ['grenier', 'combles']),

            ascenseur: this.hasFeature(lower, ['ascenseur']),

            gardien: this.hasFeature(lower, ['gardien', 'concierge']),

            digicode: this.hasFeature(lower, ['digicode']),

            interphone: this.hasFeature(lower, ['interphone']),

            visiophone: this.hasFeature(lower, ['visiophone', 'vidéophone', 'videophone']),

            climatisation: this.hasFeature(lower, ['climatisation', 'climatisé', 'climatise']),

            cheminee: this.hasFeature(lower, ['cheminée', 'cheminee']),

            cuisineEquipee: this.hasFeature(lower, [
                'cuisine équipée',
                'cuisine equipee',
                'cuisine aménagée',
                'cuisine amenagee',
            ]),

            dressing: this.hasFeature(lower, ['dressing']),

            buanderie: this.hasFeature(lower, ['buanderie', 'lingerie']),

            vueMer: this.hasFeature(lower, ['vue mer', 'vue sur mer', 'vue mer panoramique']),

            vueMontagne: this.hasFeature(lower, ['vue montagne', 'vue sur les montagnes', 'vue sur montagne']),

            vuePanoramique: this.hasFeature(lower, ['vue panoramique', 'panorama', 'vue exceptionnelle']),

            vueDegagee: this.hasFeature(lower, ['vue dégagée', 'vue degagee']),

            dernierEtage: this.hasFeature(lower, ['dernier étage', 'dernier etage']),

            traversant: this.hasFeature(lower, ['traversant']),

            lumineux: this.hasFeature(lower, ['lumineux', 'lumineuse', 'très lumineux', 'tres lumineux']),

            calme: this.hasFeature(lower, ['calme', 'au calme', 'très calme', 'tres calme']),

            renove: this.hasFeature(lower, [
                'rénové',
                'renove',
                'rénovée',
                'renovee',
                'entièrement rénové',
                'entierement renove',
            ]),

            standing: this.hasFeature(lower, ['standing', 'haut standing']),

            prestige: this.hasFeature(lower, ['prestige', 'prestigieux', 'prestigieuse']),
        };
    }

    /**
     * Détection avec gestion des négations :
     *
     * "Pas de garage" => false
     * "sans garage"   => false
     * "garage"        => true
     * "garage privatif" => true
     */
    private hasFeature(text: string, terms: string[]): boolean | null {
        for (const term of terms) {
            const escaped = this.escapeRegExp(term);

            const positive = new RegExp(`\\b${escaped}\\b`, 'i');

            if (!positive.test(text)) {
                continue;
            }

            const negative = new RegExp(`(?:pas de|sans|aucun|aucune)\\s+(?:\\w+\\s+){0,2}${escaped}\\b`, 'i');

            if (negative.test(text)) {
                return false;
            }

            return true;
        }

        return null;
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    private extractBetweenMarkers(text: string, starts: string[], ends: string[]): string | undefined {
        const lower = text.toLowerCase();

        let startIndex = -1;

        for (const marker of starts) {
            const index = lower.indexOf(marker.toLowerCase());

            if (index !== -1 && (startIndex === -1 || index < startIndex)) {
                startIndex = index;
            }
        }

        if (startIndex === -1) {
            return undefined;
        }

        const contentStart = startIndex;

        let endIndex = text.length;

        for (const marker of ends) {
            const index = lower.indexOf(marker.toLowerCase(), contentStart + 1);

            if (index !== -1 && index < endIndex) {
                endIndex = index;
            }
        }

        return text.slice(contentStart, endIndex);
    }

    private removeUndefinedValues<T extends object>(object: T): T {
        return Object.fromEntries(
            Object.entries(object).filter(([, value]) => value !== undefined && value !== null),
        ) as T;
    }

    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private logAxiosError(error: unknown): void {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;

            this.logger.error(axiosError.response?.data || axiosError.message || axiosError);

            return;
        }

        if (error instanceof Error) {
            this.logger.error(error.message);

            return;
        }

        this.logger.error(error);
    }
}
