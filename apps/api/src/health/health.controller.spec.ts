import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  const queryRaw = vi.fn();

  beforeEach(async () => {
    queryRaw.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: queryRaw,
          },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('should report that the API and database are healthy', async () => {
    queryRaw.mockResolvedValue([{ result: 1 }]);

    const result = await controller.check();

    expect(result).toMatchObject({
      status: 'ok',
      service: 'meinager-api',
      database: 'up',
    });
    expect(result.timestamp).toEqual(expect.any(String));
  });

  it('should report service unavailable when the database is down', async () => {
    queryRaw.mockRejectedValue(new Error('Database unavailable'));

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
