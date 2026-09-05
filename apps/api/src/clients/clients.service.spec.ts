import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { ClientType } from '../generated/prisma/enums.js';
import { ClientsService } from './clients.service.js';
import type { CreateClientDto } from './dto/create-client.dto.js';

describe('ClientsService', () => {
  let service: ClientsService;

  const organizationId = '9173bea8-0d7d-45ec-a08d-d1cbac34ceaf';
  const actorUserId = '53a6ba71-77b9-4aca-9493-e08e7dd11b83';

  const client = {
    id: '31122dae-d548-4c97-8c6e-58b668255141',
    type: ClientType.INDIVIDUAL,
    name: 'Cliente Teste',
    document: '12345678901',
    phone: '51999999999',
    email: 'cliente@example.com',
    notes: null,
    isActive: true,
    createdAt: new Date('2026-09-04T20:00:00.000Z'),
    updatedAt: new Date('2026-09-04T20:00:00.000Z'),
  };

  const transactionMock = {
    client: {
      create: vi.fn().mockResolvedValue(client),
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

  const dto: CreateClientDto = {
    type: ClientType.INDIVIDUAL,
    name: 'Cliente Teste',
    document: '12345678901',
    phone: '51999999999',
    email: 'cliente@example.com',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(ClientsService);
  });

  it('should create a client for the authenticated organization', async () => {
    const result = await service.create(organizationId, actorUserId, dto);

    expect(transactionMock.client.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        type: ClientType.INDIVIDUAL,
        name: dto.name,
        document: dto.document,
        phone: dto.phone,
        email: dto.email,
        notes: null,
      },
      select: {
        id: true,
        type: true,
        name: true,
        document: true,
        phone: true,
        email: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(transactionMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        actorUserId,
        action: 'client.created',
        entityType: 'client',
        entityId: client.id,
      },
    });

    expect(result).toEqual(client);
  });

  it('should reject a duplicated document in the organization', async () => {
    prismaMock.$transaction.mockRejectedValueOnce({
      code: 'P2002',
    });

    await expect(
      service.create(organizationId, actorUserId, dto),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
