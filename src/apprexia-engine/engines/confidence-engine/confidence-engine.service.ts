import { Injectable } from '@nestjs/common';
import { DvfMarketData } from '../../../analyses/interfaces/dvf-market-data.interface';
import { ApprexiaMarketData } from '../../../analyses/interfaces/apprexia-market-data.interface';

@Injectable()
export class ConfidenceEngineService {
  compute(
    dvf?: DvfMarketData | null,
    apprexia?: ApprexiaMarketData | null,
  ): number {
    const confidenceValues: number[] = [];

    if (dvf?.confidence != null) {
      confidenceValues.push(dvf.confidence);
    }

    if (apprexia?.confidence != null) {
      confidenceValues.push(apprexia.confidence);
    }

    if (confidenceValues.length === 0) {
      return 0;
    }

    const confidence =
      confidenceValues.reduce((sum, value) => sum + value, 0) /
      confidenceValues.length;

    return Math.round(confidence / 10);
  }
}
