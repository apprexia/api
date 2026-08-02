export interface AmenityResult {
  score: number;

  level:
    'Premium' | 'Très bon' | 'Bon' | 'Correct' | 'Faible' | 'Non renseigné';

  highlights: {
    label: string;
    icon: string;
    points: number;
  }[];
}
