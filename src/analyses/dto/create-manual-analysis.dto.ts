import { PropertyFeatures } from '../../meta-data-scrapper/interfaces/property-features.interface';

export class CreateManualAnalysisDto {
    adresse: string;
    ville: string;
    codePostal: string;

    latitude: number;
    longitude: number;

    typeLocal: 'Maison' | 'Appartement';

    surface: number;
    terrain?: number;

    pieces: number;

    condition?: 'NEUF' | 'EXCELLENT' | 'BON' | 'A_RAFRAICHIR' | 'A_RENOVER';
    etage?: number;

    dpe: string;
    ges: string;

    propertyFeatures: PropertyFeatures;

    sourceSite: string;

    prix: number;
}
