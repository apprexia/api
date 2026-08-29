import { PropertyFeatures } from './property-features.interface';

export interface ListingMetadata {
    source: 'html' | 'playwright' | 'firecrawl' | 'openai' | 'manual';

    url?: string;

    title?: string;
    description?: string;

    address?: string;
    streetAddress?: string;
    city?: string;
    codePostal?: string;
    codeInsee?: string;

    latitude?: number;
    longitude?: number;

    typeLocal?: 'Maison' | 'Appartement' | 'Terrain' | 'Local commercial' | 'Parking' | 'Immeuble' | 'Inconnu';
    condition?: 'NEUF' | 'EXCELLENT' | 'BON' | 'A_RAFRAICHIR' | 'A_RENOVER';
    propertyCondition?: 'NEUF' | 'ANCIEN' | 'INCONNU';

    surface?: number;
    rooms?: number;
    bedrooms?: number;
    bathrooms?: number;

    terrain?: number;

    floor?: number | null;
    totalFloors?: number;

    constructionYear?: number;

    dpe?: string;
    ges?: string;

    propertyFeatures?: PropertyFeatures;
    featureLabels?: string[];

    price?: number;
    currency?: string;

    images?: string[];

    heatingType?: string;
    charges?: number;

    reference?: string;

    sellerName?: string;
    sellerSiret?: string;
}
