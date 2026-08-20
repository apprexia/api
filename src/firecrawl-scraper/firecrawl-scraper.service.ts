import { Injectable, Logger, BadRequestException } from '@nestjs/common';

import axios, { AxiosError, AxiosInstance } from 'axios';

import { FirecrawlListingMetadata, FirecrawlResponse } from './interfaces/firecrawl-listing-metadata.interface';
import { ListingMetadata } from '../meta-data-scrapper/interfaces/listing-metadata.interface';
import { PropertyFeatures } from '../meta-data-scrapper/interfaces/property-features.interface';

@Injectable()
export class FirecrawlScraperService {
    private readonly logger = new Logger(FirecrawlScraperService.name);

    private readonly client: AxiosInstance;

    private readonly supportedPlatforms = ['leboncoin.fr', 'seloger.com', 'logic-immo.com'];

    constructor() {
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
     */
    // =========================================================================
    // SCRAPE
    // =========================================================================

    /**
     * Scrape une annonce immobilière via Firecrawl.
     *
     * Firecrawl récupère la page et nous renvoyons ensuite
     * exactement le même contrat que MetadataScraperService :
     * ListingMetadata.
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
            // Extraction
            // -------------------------------------------------------------

            const metadata = this.extractMetadata(markdown, result?.data?.metadata, url, platform);

            this.logger.log(`🔥 Métadonnées Firecrawl [${platform}] : ${JSON.stringify(metadata, null, 2)}`);

            return metadata;
        } catch (error: unknown) {
            const elapsed = Date.now() - start;

            this.logger.error(`❌ Firecrawl échec après ${elapsed} ms`);

            this.logAxiosError(error);

            throw error;
        }
    }

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

        if (value.includes('maison') || value.includes('house')) {
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

    /**
     * Retourne uniquement le Markdown.
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
     * Attention :
     * un challenge présent en fin de document ne signifie pas
     * nécessairement que l'annonce n'a pas été récupérée.
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
            // -------------------------------------------------------------
            // Informations principales
            // -------------------------------------------------------------

            title: firecrawlMetadata?.title ?? this.extractTitle(markdown, platform),

            description: this.extractDescription(text, platform),

            price: firecrawlMetadata?.price ?? this.extractPrice(text, platform),

            surface: firecrawlMetadata?.surface ?? this.extractSurface(text, platform),

            rooms: firecrawlMetadata?.rooms ?? this.extractRooms(text, platform),

            bedrooms: firecrawlMetadata?.bedrooms ?? this.extractBedrooms(text),

            bathrooms: firecrawlMetadata?.bathrooms ?? this.extractBathrooms(text),

            // -------------------------------------------------------------
            // Localisation
            // -------------------------------------------------------------

            city: firecrawlMetadata?.city ?? this.extractCity(text, platform),

            codePostal: firecrawlMetadata?.codePostal ?? this.extractPostalCode(text),

            address: firecrawlMetadata?.address,

            streetAddress: firecrawlMetadata?.streetAddress,

            // -------------------------------------------------------------
            // Type
            // -------------------------------------------------------------

            typeLocal: firecrawlMetadata?.typeLocal ?? this.extractPropertyType(text, platform),

            // -------------------------------------------------------------
            // DPE / GES
            // -------------------------------------------------------------

            dpe: firecrawlMetadata?.dpe ?? this.extractDpe(markdown, text, platform),

            ges: firecrawlMetadata?.ges ?? this.extractGes(markdown, text, platform),

            // -------------------------------------------------------------
            // Images
            // -------------------------------------------------------------

            images: this.extractImages(markdown, platform),

            // -------------------------------------------------------------
            // Caractéristiques
            // -------------------------------------------------------------

            propertyFeatures: this.extractFeatures(text),

            // -------------------------------------------------------------
            // Informations complémentaires
            // -------------------------------------------------------------

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
                // Images markdown
                .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')

                // Liens markdown
                .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')

                // Titres markdown
                .replace(/^#{1,6}\s*/gm, '')

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
        // Tous les sites utilisent généralement un H1.
        const h1 = markdown.match(/^#\s+(.+?)(?:\n|$)/m);

        if (h1?.[1]) {
            return this.cleanTitle(h1[1]);
        }

        if (platform === 'leboncoin') {
            const match = markdown.match(/(?:^|\n)(Appartement|Maison|Studio|Villa|Loft|Duplex|Terrain)[^\n]{0,150}/i);

            if (match?.[0]) {
                return this.cleanTitle(match[0]);
            }
        }

        if (platform === 'seloger') {
            const match = markdown.match(/(?:Maison|Appartement|Studio|Villa|Loft|Duplex)[^\n]{0,150}/i);

            if (match?.[0]) {
                return this.cleanTitle(match[0]);
            }
        }

        return undefined;
    }

    private cleanTitle(value: string): string {
        return value
            .replace(/\s+/g, ' ')
            .replace(/^\s*#+\s*/, '')
            .trim();
    }

    // =========================================================================
    // PRICE
    // =========================================================================

    private extractPrice(text: string, platform?: 'leboncoin' | 'seloger' | 'logic-immo'): number | undefined {
        const patterns: RegExp[] = [];

        if (platform === 'leboncoin') {
            patterns.push(
                /Prix du bien\s*\(?(?:Honoraires inclus)?\)?\s*[:\-]?\s*([\d\s.\u00A0\u202F]+)\s*€/i,

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

        // Fallback commun
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

            const value = match[1].replace(/[^\d]/g, '');

            const price = Number(value);

            if (price >= 10_000 && price <= 100_000_000) {
                return price;
            }
        }

        /*
         * Dernier fallback :
         *
         * On recherche un prix avec €
         * mais on ignore explicitement :
         *
         * - prix / m²
         * - mensualités
         * - intérêts
         * - frais de notaire
         * - facture énergétique
         */
        const generic = /([\d\s.\u00A0\u202F]{4,})\s*€/g;

        let match: RegExpExecArray | null;

        while ((match = generic.exec(text)) !== null) {
            const before = text.slice(Math.max(0, match.index - 80), match.index).toLowerCase();

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

            const value = match[1].replace(/[^\d]/g, '');

            const price = Number(value);

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

            if (match?.[1]) {
                const rooms = Number(match[1]);

                if (rooms >= 1 && rooms <= 30) {
                    return rooms;
                }
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

            if (match?.[1]) {
                const bedrooms = Number(match[1]);

                if (bedrooms >= 0 && bedrooms <= 30) {
                    return bedrooms;
                }
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

            if (match?.[1]) {
                return Number(match[1]);
            }
        }

        return undefined;
    }

    // =========================================================================
    // POSTAL CODE
    // =========================================================================

    private extractPostalCode(text: string): string | undefined {
        const patterns = [/(?:·|•)\s*[A-Za-zÀ-ÿ0-9'’ .\-]+\s+(\d{5})\b/i, /\b(\d{5})\b/];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (match?.[1]) {
                const cp = match[1];

                if (this.isValidFrenchPostalCode(cp)) {
                    return cp;
                }
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
        /*
         * Leboncoin :
         *
         * Tours (37000)
         * Tours 37000
         */
        let match = text.match(/\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ .\-]{1,60})\s*\(\s*(\d{5})\s*\)/i);

        if (match?.[1]) {
            return this.cleanCity(match[1]);
        }

        /*
         * Exemple :
         *
         * Tours 37000 · Quartier Centre-ville
         */
        match = text.match(/\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ .\-]{1,60})\s+(\d{5})\s*(?:·|•|$)/i);

        if (match?.[1]) {
            return this.cleanCity(match[1]);
        }

        /*
         * Exemple SeLoger :
         *
         * Pointe Rouge, Marseille 8ème arrondissement (13008)
         *
         * On cherche la partie précédant
         * l'arrondissement.
         */
        match = text.match(
            /,\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ .\-]+?)\s+\d+(?:er|ère|ème|e)?\s+arrondissement\s*\(\s*\d{5}\s*\)/i,
        );

        if (match?.[1]) {
            return this.cleanCity(match[1]);
        }

        /*
         * Variante :
         *
         * Marseille 8ème arrondissement (13008)
         */
        match = text.match(
            /\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ .\-]+?)\s+\d+(?:er|ère|ème|e)?\s+arrondissement\s*\(\s*\d{5}\s*\)/i,
        );

        if (match?.[1]) {
            return this.cleanCity(match[1]);
        }

        /*
         * Logic-Immo / SeLoger :
         *
         * Ville : Marseille
         */
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

        /*
         * SeLoger :
         *
         * Maison à vendre
         * Appartement à vendre
         */
        if (/\bMaison\s+à\s+vendre\b/i.test(text)) {
            return 'Maison';
        }

        if (/\bAppartement\s+à\s+vendre\b/i.test(text)) {
            return 'Appartement';
        }

        /*
         * Cabanon à usage d'habitation.
         *
         * Pour Apprexia, on le classe comme Maison.
         */
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
        /*
         * 1. Cas explicite :
         *
         * DPE : C
         * Classe énergie : C
         */
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

        /*
         * 2. Extraction prudente depuis le Markdown brut.
         *
         * Important :
         *
         * Leboncoin peut afficher :
         *
         * Classe énergie
         *
         * A
         * B
         * C
         * D
         * E
         * F
         * G
         *
         * Dans ce cas on retourne undefined.
         *
         * Si une seule lettre A-G est présente entre
         * "Classe énergie" et "GES", on peut considérer
         * cette valeur comme exploitable.
         */
        const section = this.extractBetweenMarkers(
            markdown,
            ['Classe énergie', 'Diagnostic de performance énergétique', 'DPE'],
            ['GES', 'Indice d’émission', "Indice d'émission"],
        );

        if (section) {
            const classes = section.match(/(?:^|\s)([A-G])(?:\s|$)/gi) || [];

            const values = classes.map((value) => value.trim().toUpperCase()).filter((value) => /^[A-G]$/.test(value));

            const unique = [...new Set(values)];

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
            const classes = section.match(/(?:^|\s)([A-G])(?:\s|$)/gi) || [];

            const values = classes.map((value) => value.trim().toUpperCase()).filter((value) => /^[A-G]$/.test(value));

            const unique = [...new Set(values)];

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

    private extractImages(markdown: string, platform?: 'leboncoin' | 'seloger' | 'logic-immo'): string[] {
        const urls: string[] = [];

        /*
         * Images Markdown :
         *
         * ![...](https://...)
         */
        const markdownRegex = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;

        let match: RegExpExecArray | null;

        while ((match = markdownRegex.exec(markdown)) !== null) {
            urls.push(match[1]);
        }

        /*
         * URLs d'images éventuellement présentes
         * directement dans le contenu.
         */
        const directRegex = /https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi;

        while ((match = directRegex.exec(markdown)) !== null) {
            urls.push(match[0]);
        }

        const filtered = urls.filter((url) => this.isPropertyImage(url, platform));

        return [...new Set(filtered.map((url) => url.trim()))];
    }

    private isPropertyImage(url: string, platform?: 'leboncoin' | 'seloger' | 'logic-immo'): boolean {
        const lower = url.toLowerCase();

        /*
         * Leboncoin
         */
        if (lower.includes('img.leboncoin.fr')) {
            return true;
        }

        /*
         * SeLoger
         */
        if (lower.includes('mms.seloger.com')) {
            return true;
        }

        if (
            lower.includes('seloger.com') &&
            (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || lower.includes('.webp'))
        ) {
            return true;
        }

        /*
         * Logic-Immo
         */
        if (
            lower.includes('logic-immo.com') &&
            (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || lower.includes('.webp'))
        ) {
            return true;
        }

        /*
         * Certains CDN ne contiennent pas le domaine
         * du portail mais restent manifestement des images.
         *
         * On accepte ici les images uniquement lorsque
         * le nom indique une ressource immobilière.
         */
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

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            const year = Number(match[1]);

            const currentYear = new Date().getFullYear();

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

            if (match?.[1]) {
                return Number(match[1]);
            }
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

            if (match?.[1]) {
                return Number(match[1]);
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

            if (match?.[1] && match[1].trim().length > 0) {
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

            if (match?.[1] && match[1].trim().length > 1) {
                return match[1].trim();
            }
        }

        return undefined;
    }

    // =========================================================================
    // SIRET
    // =========================================================================

    private extractSiret(text: string): string | undefined {
        const patterns = [/SIRET\s*[:\-]?\s*(\d{14})/i, /SIREN\s*[:\-]?\s*(\d{9})/i];

        for (const pattern of patterns) {
            const match = text.match(pattern);

            if (!match?.[1]) {
                continue;
            }

            if (match[1].length === 14) {
                return match[1];
            }
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
     * "Pas de garage"       => false
     * "sans garage"         => false
     * "garage"              => true
     * "garage privatif"     => true
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

    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private removeUndefinedValues<T extends object>(object: T): T {
        return Object.fromEntries(
            Object.entries(object).filter(([, value]) => value !== undefined && value !== null),
        ) as T;
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
