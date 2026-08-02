import { Test, TestingModule } from '@nestjs/testing';
import { CommuneIndicatorController } from './commune-indicator.controller';

describe('CommuneIndicatorController', () => {
  let controller: CommuneIndicatorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommuneIndicatorController],
    }).compile();

    controller = module.get<CommuneIndicatorController>(CommuneIndicatorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
