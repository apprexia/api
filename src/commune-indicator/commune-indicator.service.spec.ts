import { Test, TestingModule } from '@nestjs/testing';
import { CommuneIndicatorService } from './commune-indicator.service';

describe('CommuneIndicatorService', () => {
  let service: CommuneIndicatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommuneIndicatorService],
    }).compile();

    service = module.get<CommuneIndicatorService>(CommuneIndicatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
