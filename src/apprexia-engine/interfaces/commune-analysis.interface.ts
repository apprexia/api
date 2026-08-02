export interface CommuneAnalysis {
  score: number;

  level: 'Excellent' | 'Bon' | 'Moyen' | 'Faible';

  strengths: string[];

  weaknesses: string[];

  breakdown: {
    realEstate: number;
    demographics: number;
    accessibility: number;
    environment: number;
    taxation: number;
  };
}
