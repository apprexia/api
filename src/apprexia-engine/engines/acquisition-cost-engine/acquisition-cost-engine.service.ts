import { Injectable } from '@nestjs/common';
import { PropertyCondition } from '@prisma/client';

export interface AcquisitionCostInput {
    price?: number | null;
    propertyCondition?: PropertyCondition | null;
}

export interface AcquisitionCostResult {
    notaryFees: number;
    notaryFeeRate: number;
}

@Injectable()
export class AcquisitionCostEngineService {
    compute(input: AcquisitionCostInput): AcquisitionCostResult {
        const price = Number(input.price ?? 0);

        if (!Number.isFinite(price) || price <= 0) {
            return {
                notaryFees: 0,
                notaryFeeRate: 0,
            };
        }

        const notaryFeeRate = this.getNotaryFeeRate(input.propertyCondition);

        const notaryFees = Math.round(price * notaryFeeRate * 100) / 100;

        return {
            notaryFees,
            notaryFeeRate,
        };
    }

    private getNotaryFeeRate(propertyCondition?: PropertyCondition | null): number {
        switch (propertyCondition) {
            case PropertyCondition.NEUF:
                return 0.025;

            case PropertyCondition.ANCIEN:
                return 0.08;

            case PropertyCondition.INCONNU:
            default:
                return 0.08;
        }
    }
}
