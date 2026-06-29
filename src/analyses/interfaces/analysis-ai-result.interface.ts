export interface AnalysisAiResult {
  title: string;
  city: string;

  rooms: number;
  surface: number;

  score: number;
  scoreExplanation: string;

  verdict: string;
  verdictExplanation: string;

  estimatedValue: number;
  askingPrice: number;

  recommendedPrice: number;

  negotiationAmount: number;
  negotiationPotential: number;
  negotiationAnalysis: string;

  description: string;

  imageUrl: string;

  marketPosition: string;

  riskLevel: number;

  grossYield: number;
  yieldLevel: string;
  yieldAnalysis: string;

  strengths: string[];

  risks: string[];
}
