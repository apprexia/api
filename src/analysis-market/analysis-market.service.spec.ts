import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisMarketService } from './analysis-market.service';

describe('AnalysisMarketService', () => {
  let service: AnalysisMarketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalysisMarketService],
    }).compile();

    service = module.get<AnalysisMarketService>(AnalysisMarketService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
