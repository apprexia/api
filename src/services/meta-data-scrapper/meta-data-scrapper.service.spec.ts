import { Test, TestingModule } from '@nestjs/testing';
import { MetaDataScrapperService } from './meta-data-scrapper.service';

describe('MetaDataScrapperService', () => {
  let service: MetaDataScrapperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetaDataScrapperService],
    }).compile();

    service = module.get<MetaDataScrapperService>(MetaDataScrapperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
