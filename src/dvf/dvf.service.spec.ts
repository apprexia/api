import { Test, TestingModule } from '@nestjs/testing';
import { DvfService } from './dvf.service';

describe('DvfService', () => {
  let service: DvfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DvfService],
    }).compile();

    service = module.get<DvfService>(DvfService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
