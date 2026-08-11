import { Module } from '@nestjs/common';
import { ApprexiaEngineService } from './apprexia-engine.service';
import { ScoreEngineService } from './engines/score-engine/score-engine.service';
import { VerdictEngineService } from './engines/verdict-engine/verdict-engine.service';
import { NegotiationEngineService } from './engines/negotiation-engine/negotiation-engine.service';
import { MarketPositionEngineService } from './engines/market-position-engine/market-position-engine.service';
import { ConfidenceEngineService } from './engines/confidence-engine/confidence-engine.service';
import { RecommendedPriceEngineService } from './engines/recommended-price-engine/recommended-price-engine.service';
import { YieldEngineService } from './engines/yield-engine/yield-engine.service';
import { RentalEngineService } from './engines/rental-engine/rental-engine.service';
import { RentalMarketModule } from '../rental-market/rental-market.module';
import { PropertyValueAdjustmentEngineService } from './engines/property-value-adjustment/property-value-adjustment.service';
import { OpportunityEngineService } from './engines/opportunity-engine/opportunity-engine.service';
import { AmenityEngineService } from './engines/amenity-engine/amenity-engine.service';
import { LiquidityEngineService } from './engines/liquidity-engine/liquidity-engine.service';
import { LocationProviderService } from './providers/location-provider/location-provider.service';
import { HttpModule } from '@nestjs/axios';
import { LocationEngineService } from './engines/location-engine/location-engine.service';
import { GeocodingProviderService } from './providers/geocoding-provider/geocoding-provider.service';
import { CommuneEngineService } from './engines/commune-engine/commune-engine.service';
import { EnergyEngineService } from './engines/energy-engine/energy-engine.service';

@Module({
    imports: [HttpModule, RentalMarketModule],
    providers: [
        ApprexiaEngineService,
        ScoreEngineService,
        VerdictEngineService,
        OpportunityEngineService,
        AmenityEngineService,
        LiquidityEngineService,
        NegotiationEngineService,
        MarketPositionEngineService,
        RentalEngineService,
        ConfidenceEngineService,
        RecommendedPriceEngineService,
        YieldEngineService,
        PropertyValueAdjustmentEngineService,
        LocationEngineService,
        LocationProviderService,
        GeocodingProviderService,
        CommuneEngineService,
        EnergyEngineService,
    ],
    exports: [
        ApprexiaEngineService,
        LocationEngineService,
        LocationProviderService,
        GeocodingProviderService,
        AmenityEngineService,
        EnergyEngineService,
    ],
})
export class ApprexiaEngineModule {}
