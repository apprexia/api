import { Test, TestingModule } from '@nestjs/testing';
import { DvfController } from './dvf.controller';

describe('DvfController', () => {
  let controller: DvfController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DvfController],
    }).compile();

    controller = module.get<DvfController>(DvfController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
