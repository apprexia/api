import { PropertyFeatures } from '../../meta-data-scrapper/interfaces/property-features.interface';

export interface FirecrawlListingMetadata {
    title?: string;

    price?: number;
    surface?: number;
    rooms?: number;
    bedrooms?: number;
    bathrooms?: number;

    city?: string;
    codePostal?: string;
    address?: string;
    streetAddress?: string;

    typeLocal?: string;
    propertyCondition?: 'NEUF' | 'ANCIEN' | 'INCONNU';

    dpe?: string;
    ges?: string;

    description?: string;

    imageUrl?: string;
    images?: string[];

    propertyFeatures?: PropertyFeatures;

    constructionYear?: number;
    floor?: number;
    totalFloors?: number;

    heatingType?: string;

    charges?: number;

    reference?: string;

    sellerName?: string;
    sellerSiret?: string;

    sourceUrl?: string;
}

export interface FirecrawlResponse {
    success: boolean;

    data?: {
        markdown?: string;
        metadata?: Record<string, any>;
    };

    error?: string;
}
