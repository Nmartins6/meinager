import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service.js';
import { SessionService } from './session.service.js';

describe('SessionService', () => {
  let service: SessionService;

  const prismaMock = {
    session: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const configServiceMock = {
    get: vi.fn().mockReturnValue('30'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get(SessionService);
  });

  it('should create a random session and persist only its hash', async () => {
    const session = await service.create('user-id', {
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.expiresAt).toBeInstanceOf(Date);

    expect(prismaMock.session.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-id',
        tokenHash: service.hashToken(session.token),
        expiresAt: session.expiresAt,
        ipAddress: '127.0.0.1',
        userAgent: 'Vitest',
      },
    });

    expect(prismaMock.session.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash: session.token,
        }),
      }),
    );
  });

  it('should revoke a session by its hashed token', async () => {
    await service.revoke('raw-session-token');

    expect(prismaMock.session.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: service.hashToken('raw-session-token'),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });
});
