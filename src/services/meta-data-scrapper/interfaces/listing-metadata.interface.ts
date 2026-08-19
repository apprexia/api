import { PropertyFeatures } from './property-features.interface';

export interface ListingMetadata {
    source: 'html' | 'playwright' | 'openai' | 'manual';

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

    surface?: number;
    rooms?: number;
    terrain?: number;
    floor?: number | null;
    bedrooms?: number;
    constructionYear?: number;
    condition?: string;
    dpe?: string;
    ges?: string;

    propertyFeatures?: PropertyFeatures;
    featureLabels?: string[];

    price?: number;
    currency?: string;

    images?: string[];
}
