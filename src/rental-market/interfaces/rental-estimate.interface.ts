export interface RentalEstimate {
  rentPerM2: number;

  monthlyRent: number;

  lowRent: number;

  highRent: number;

  confidence: number;

  source: string;
}
