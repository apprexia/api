export interface RentalResult {
  estimatedRentMonthly: number | null;
  estimatedRentLow: number | null;
  estimatedRentHigh: number | null;
  rentPerSquareMeter: number | null;
  rentConfidence: number | null;

  grossYield: number | null;
  yieldLevel: string;
  yieldAnalysis: string;
}
