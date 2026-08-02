import { Test, TestingModule } from '@nestjs/testing';
import { RentalMarketService } from './rental-market.service';

describe('RentalMarketService', () => {
  let service: RentalMarketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RentalMarketService],
    }).compile();

    service = module.get<RentalMarketService>(RentalMarketService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
