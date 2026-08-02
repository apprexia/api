import { Injectable } from '@nestjs/common';
import { EngineContext } from '../../interfaces/engine-context.interface';
import { MarketPosition } from '../../interfaces/market-position.interface';

@Injectable()
export class MarketPositionEngineService {
  compute(context: EngineContext): MarketPosition {
    const { askingPrice, estimatedValueLow, estimatedValueHigh } =
      context.analysis;

    if (!askingPrice || !estimatedValueLow || !estimatedValueHigh) {
      return 'PRIX MARCHE';
    }

    if (askingPrice < estimatedValueLow) {
      return 'SOUS EVALUE';
    }

    if (askingPrice <= estimatedValueHigh) {
      return 'PRIX MARCHE';
    }

    const overPrice =
      ((askingPrice - estimatedValueHigh) / estimatedValueHigh) * 100;

    if (overPrice <= 10) {
      return 'LEGEREMENT SURCOTE';
    }

    return 'SURCOTE';
  }
}
