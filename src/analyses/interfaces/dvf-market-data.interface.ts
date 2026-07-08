export interface DvfMarketData {
  // Nombre de transactions utilisées
  count: number;

  // Statistiques brutes marché
  averagePriceM2: number;

  medianPriceM2: number;

  // Prix/m² utilisé pour l'estimation finale
  adjustedPriceM2: number;

  // Valeur estimée DVF
  dvfReferenceValue: number;

  // Intervalle d'estimation
  lowEstimate: number;

  highEstimate: number;

  // Fiabilité de l'analyse
  confidence: number;

  // Prix/m² demandé par l'annonce
  askingPriceM2?: number;

  // Ecart entre annonce et DVF
  priceDifferencePercent?: number;

  // Nombre de ventes vraiment comparables
  strongComparablesCount?: number;

  // Différence moyenne de surface avec les comparables
  averageSurfaceDifference?: number;

  // Quartile bas du marché
  q1PriceM2?: number;

  // Médiane déjà présente mais utile
  q2PriceM2?: number;

  // Quartile haut du marché
  q3PriceM2?: number;

  // Rayon géographique utilisé
  searchRadius?: number;

  // Ancienneté moyenne des transactions
  averageTransactionAge?: number;

  // Explication lisible pour OpenAI
  confidenceReason?: string;

  // Commentaire automatique DVF
  marketSummary?: string;
}
