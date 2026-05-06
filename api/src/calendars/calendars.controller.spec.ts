import { Test, TestingModule } from '@nestjs/testing';
import { CalendarsController } from './calendars.controller';

describe('CalendarsController', () => {
  let controller: CalendarsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarsController],
    }).compile();

    controller = module.get<CalendarsController>(CalendarsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
