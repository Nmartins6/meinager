import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { verify } from 'argon2';
import { OrganizationRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';

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
  };

  const prismaMock = {
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

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('should create the owner and organization in one transaction', async () => {
    const result = await service.register(dto);

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

    expect(transactionMock.auditLog.create).toHaveBeenCalledOnce();

    expect(result).toEqual({
      user,
      organization: {
        ...organization,
        role: OrganizationRole.OWNER,
      },
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('should return conflict for duplicated unique data', async () => {
    prismaMock.$transaction.mockRejectedValueOnce({ code: 'P2002' });

    await expect(service.register(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
