import { Test } from '@nestjs/testing';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = moduleRef.get(AppController);
  });

  describe('health', () => {
    it('returns ok status with service name', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        service: 'AutoGenius',
      });
    });
  });
});
