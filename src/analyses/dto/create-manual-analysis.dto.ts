import { PropertyFeatures } from '../../services/meta-data-scrapper/interfaces/property-features.interface';

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

  etat: string;
  etage?: number;

  dpe: string;

  propertyFeatures: PropertyFeatures;

  sourceSite: string;

  prix: number;
}
