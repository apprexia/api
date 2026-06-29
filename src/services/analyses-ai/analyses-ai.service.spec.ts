import { Test, TestingModule } from '@nestjs/testing';
import { AnalysesAiService } from './analyses-ai.service';

describe('AnalysesAiService', () => {
  let service: AnalysesAiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalysesAiService],
    }).compile();

    service = module.get<AnalysesAiService>(AnalysesAiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
