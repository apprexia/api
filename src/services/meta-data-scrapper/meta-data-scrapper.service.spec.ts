import { Test, TestingModule } from '@nestjs/testing';
import { MetadataScraperService } from './meta-data-scrapper.service';

describe('MetaDataScrapperService', () => {
  let service: MetadataScraperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetadataScraperService],
    }).compile();

    service = module.get<MetadataScraperService>(MetadataScraperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
