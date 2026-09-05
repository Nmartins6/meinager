import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { ClientType } from '../generated/prisma/enums.js';
import type { CreateClientDto } from './dto/create-client.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ListClientsQueryDto } from './dto/list-clients-query.dto.js';

export interface ClientResponse {
  id: string;
  type: ClientType;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedClientsResponse {
  data: ClientResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateClientDto,
  ): Promise<ClientResponse> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const client = await transaction.client.create({
          data: {
            organizationId,
            type: dto.type,
            name: dto.name,
            document: dto.document ?? null,
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            notes: dto.notes ?? null,
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

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'client.created',
            entityType: 'client',
            entityId: client.id,
          },
        });

        return client;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Já existe um cliente com este CPF ou CNPJ.',
        );
      }

      throw error;
    }
  }

  async findAll(
    organizationId: string,
    query: ListClientsQueryDto,
  ): Promise<PaginatedClientsResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search;
    const searchDigits = search?.replace(/\D/g, '');

    const searchFilters: Prisma.ClientWhereInput[] = search
      ? [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ]
      : [];

    if (searchDigits) {
      searchFilters.push(
        {
          document: {
            contains: searchDigits,
          },
        },
        {
          phone: {
            contains: searchDigits,
          },
        },
      );
    }

    const where: Prisma.ClientWhereInput = {
      organizationId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(searchFilters.length > 0 ? { OR: searchFilters } : {}),
    };

    const [clients, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      this.prisma.client.count({
        where,
      }),
    ]);

    return {
      data: clients,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private isUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
