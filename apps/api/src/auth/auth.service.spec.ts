import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash, verify } from 'argon2';
import {
  OrganizationRole,
  OrderStageCategory,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { SessionService } from './session/session.service.js';
import { LoginDto } from './dto/login.dto.js';

describe('AuthService', () => {
  let service: AuthService;

  const user = {
    id: '53a6ba71-77b9-4aca-9493-e08e7dd11b83',
    name: 'Nicolas Martins',
    email: 'Nicolas@example.com',
  };

  const organization = {
    id: '9173bea8-0d7d-45ec-a08d-d1cbac34ceaf',
    name: 'Empresa Teste',
    slug: 'empresa-teste-a1b2c3d4',
  };

  const transactionMock = {
    user: {
      create: vi.fn().mockResolvedValue(user),
    },
    organization: {
      create: vi.fn().mockResolvedValue(organization),
    },
    organizationMember: {
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    session: {
      create: vi.fn().mockResolvedValue({}),
    },
    orderWorkflow: {
      create: vi.fn().mockResolvedValue({}),
    },
  };

  const prismaMock = {
    user: {
      findUnique: vi
        .fn<(args: unknown) => Promise<unknown>>()
        .mockResolvedValue(null),
    },

    $transaction: vi.fn(
      async (
        callback: (transaction: typeof transactionMock) => Promise<unknown>,
      ) => callback(transactionMock),
    ),
  };

  const dto: RegisterDto = {
    name: 'Nicolas Martins',
    email: 'Nicolas@example.com',
    password: 'senha-segura',
    organizationName: 'Empresa Teste',
    document: '12345678901',
    segment: 'Serviços',
  };

  const sessionExpiresAt = new Date('2026-10-04T12:00:00.000Z');

  const sessionServiceMock = {
    prepare: vi.fn().mockReturnValue({
      token: 'raw-session-token',
      tokenHash: 'hashed-session-token',
      expiresAt: sessionExpiresAt,
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    }),
    create: vi.fn().mockResolvedValue({
      token: 'login-session-token',
      expiresAt: sessionExpiresAt,
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: SessionService,
          useValue: sessionServiceMock,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('should create the owner and organization in one transaction', async () => {
    const result = await service.register(dto, {
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(sessionServiceMock.prepare).toHaveBeenCalledWith({
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(transactionMock.session.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        tokenHash: 'hashed-session-token',
        expiresAt: sessionExpiresAt,
        ipAddress: '127.0.0.1',
        userAgent: 'Vitest',
      },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();

    const userCreateInput = transactionMock.user.create.mock.calls[0]![0] as {
      data: {
        passwordHash: string;
        normalizedEmail: string;
      };
    };

    expect(userCreateInput.data.normalizedEmail).toBe('nicolas@example.com');
    expect(userCreateInput.data.passwordHash).not.toBe(dto.password);
    expect(await verify(userCreateInput.data.passwordHash, dto.password)).toBe(
      true,
    );

    expect(transactionMock.organizationMember.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: OrganizationRole.OWNER,
      },
    });

    expect(transactionMock.orderWorkflow.create).toHaveBeenCalledWith({
      data: {
        organizationId: organization.id,
        name: 'Fluxo geral',
        normalizedName: 'fluxo geral',
        isDefault: true,
        stages: {
          create: [
            {
              name: 'Pendente',
              position: 1,
              category: OrderStageCategory.PENDING,
            },
            {
              name: 'Em andamento',
              position: 2,
              category: OrderStageCategory.IN_PROGRESS,
            },
            {
              name: 'Concluído',
              position: 3,
              category: OrderStageCategory.COMPLETED,
            },
          ],
        },
      },
    });

    expect(transactionMock.auditLog.create).toHaveBeenCalledOnce();

    expect(result).toEqual({
      user,
      organization: {
        ...organization,
        role: OrganizationRole.OWNER,
      },
      session: {
        token: 'raw-session-token',
        expiresAt: sessionExpiresAt,
      },
    });

    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('should authenticate a valid user and create a session', async () => {
    const loginDto: LoginDto = {
      email: 'Nicolas@example.com',
      password: 'senha-segura',
    };

    const passwordHash = await hash(loginDto.password);

    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...user,
      passwordHash,
      isActive: true,
      memberships: [
        {
          role: OrganizationRole.OWNER,
          organization,
        },
      ],
    });

    const result = await service.login(loginDto, {
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          normalizedEmail: 'nicolas@example.com',
        },
      }),
    );

    expect(sessionServiceMock.create).toHaveBeenCalledWith(user.id, {
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(result).toEqual({
      user,
      organization: {
        ...organization,
        role: OrganizationRole.OWNER,
      },
      session: {
        token: 'login-session-token',
        expiresAt: sessionExpiresAt,
      },
    });

    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('should reject an unknown user without creating a session', async () => {
    const loginDto: LoginDto = {
      email: 'unknown@example.com',
      password: 'senha-inexistente',
    };

    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.login(loginDto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(sessionServiceMock.create).not.toHaveBeenCalled();
  });

  it('should return conflict for duplicated unique data', async () => {
    prismaMock.$transaction.mockRejectedValueOnce({ code: 'P2002' });

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
