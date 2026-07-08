export class CreateManualAnalysisDto {
  adresse: string;
  ville: string;
  codePostal: string;
  latitude: number;
  longitude: number;
  typeLocal: 'Maison' | 'Appartement';
  surface: number;
  pieces: number;
  etat: string;
  etage?: number;
  balcon: boolean;
  parking: boolean;
  dpe: string;
  sourceSite: string;
  prix: number;
}
