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
      update: vi.fn().mockResolvedValue({ contextVersion: 1 }),
      findFirst: vi.fn(),
    },
    organizationMember: { findFirst: vi.fn(), findMany: vi.fn() },
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
        activeOrganizationId: null,
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

  it('denies an unauthorized organization switch', async () => {
    prismaMock.organizationMember.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.switchOrganization('session', 'user', 'foreign'),
    ).rejects.toThrow();
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('switches only the current session after checking an active membership', async () => {
    prismaMock.organizationMember.findFirst.mockResolvedValueOnce({
      role: 'ADMIN',
      organization: { id: 'organization', name: 'Casa', slug: 'casa' },
    });
    const result = await service.switchOrganization(
      'session-a',
      'user',
      'organization',
    );
    expect(result.role).toBe('ADMIN');
    expect(result.contextVersion).toBe(1);
    expect(prismaMock.session.update).toHaveBeenCalledWith({
      where: {
        id: 'session-a',
        userId: 'user',
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: {
        activeOrganizationId: 'organization',
        contextVersion: { increment: 1 },
      },
      select: { contextVersion: true },
    });
  });

  it('rejects a session whose selected membership has been deactivated', async () => {
    prismaMock.session.findFirst.mockResolvedValueOnce({
      id: 'session',
      activeOrganizationId: 'organization',
      contextVersion: 0,
      user: { id: 'user', name: 'Name', email: 'user@example.invalid' },
    });
    prismaMock.organizationMember.findFirst.mockResolvedValueOnce(null);
    await expect(service.findAuthenticated('token')).resolves.toBeNull();
  });

  it('uses the current membership role on every request', async () => {
    prismaMock.session.findFirst.mockResolvedValue({
      id: 'session',
      activeOrganizationId: 'organization',
      contextVersion: 0,
      user: { id: 'user', name: 'Name', email: 'user@example.invalid' },
    });
    prismaMock.organizationMember.findFirst
      .mockResolvedValueOnce({
        role: 'VIEWER',
        organization: { id: 'organization', name: 'Casa', slug: 'casa' },
      })
      .mockResolvedValueOnce({
        role: 'ADMIN',
        organization: { id: 'organization', name: 'Casa', slug: 'casa' },
      });
    expect((await service.findAuthenticated('token'))?.organization.role).toBe(
      'VIEWER',
    );
    expect((await service.findAuthenticated('token'))?.organization.role).toBe(
      'ADMIN',
    );
  });
});
