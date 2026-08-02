import { Test, TestingModule } from '@nestjs/testing';
import { ApprexiaEngineService } from './apprexia-engine.service';

describe('ApprexiaEngineService', () => {
  let service: ApprexiaEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApprexiaEngineService],
    }).compile();

    service = module.get<ApprexiaEngineService>(ApprexiaEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
