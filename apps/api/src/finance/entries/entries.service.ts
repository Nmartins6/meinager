import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  FinancialCategoryType,
  FinancialPeriodStatus,
  FinancialRevenueSource,
} from '../../generated/prisma/enums.js';
import type {
  ClientType,
  FinancialEntryOrigin,
  FinancialEntryStatus,
} from '../../generated/prisma/enums.js';
import type { CreateEntryDto } from './dto/create-entry.dto.js';
import type { ListEntriesQueryDto } from './dto/list-entries-query.dto.js';

export interface FinancialEntryResponse {
  id: string;
  description: string;
  amount: string;
  dueDate: string;
  status: FinancialEntryStatus;
  origin: FinancialEntryOrigin;
  sourceEntryId: string | null;
  notes: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  period: {
    id: string;
    year: number;
    month: number;
    status: FinancialPeriodStatus;
  };
  category: {
    id: string;
    name: string;
    type: FinancialCategoryType;
  };
  client: {
    id: string;
    name: string;
    type: ClientType;
  } | null;
}

export interface PaginatedFinancialEntriesResponse {
  data: FinancialEntryResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class EntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateEntryDto,
  ): Promise<FinancialEntryResponse> {
    const dueDate = this.parseDate(dto.dueDate);

    return this.prisma.$transaction(async (transaction) => {
      const period = await transaction.financialPeriod.findFirst({
        where: {
          id: dto.periodId,
          organizationId,
        },
        select: {
          id: true,
          year: true,
          month: true,
          status: true,
          revenueSource: true,
        },
      });

      if (!period) {
        throw new NotFoundException('Competência financeira não encontrada.');
      }

      if (period.status === FinancialPeriodStatus.CLOSED) {
        throw new BadRequestException(
          'Não é possível criar lançamentos em uma competência fechada.',
        );
      }

      if (
        dueDate.getUTCFullYear() !== period.year ||
        dueDate.getUTCMonth() + 1 !== period.month
      ) {
        throw new BadRequestException(
          'A data de vencimento deve pertencer à competência informada.',
        );
      }

      const category = await transaction.financialCategory.findFirst({
        where: {
          id: dto.categoryId,
          organizationId,
        },
        select: {
          id: true,
          name: true,
          type: true,
          isActive: true,
        },
      });

      if (!category) {
        throw new NotFoundException('Categoria financeira não encontrada.');
      }

      if (!category.isActive) {
        throw new BadRequestException(
          'Não é possível usar uma categoria financeira inativa.',
        );
      }

      if (
        category.type === FinancialCategoryType.REVENUE &&
        period.revenueSource === FinancialRevenueSource.MANUAL_TOTAL
      ) {
        throw new ConflictException(
          'Esta competência usa receita manual e não aceita lançamentos de receita.',
        );
      }

      let client: {
        id: string;
        name: string;
        type: ClientType;
      } | null = null;

      if (dto.clientId) {
        const selectedClient = await transaction.client.findFirst({
          where: {
            id: dto.clientId,
            organizationId,
          },
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
          },
        });

        if (!selectedClient) {
          throw new NotFoundException('Cliente não encontrado.');
        }

        if (!selectedClient.isActive) {
          throw new BadRequestException(
            'Não é possível vincular um cliente inativo.',
          );
        }

        client = {
          id: selectedClient.id,
          name: selectedClient.name,
          type: selectedClient.type,
        };
      }

      const entry = await transaction.financialEntry.create({
        data: {
          organizationId,
          periodId: period.id,
          categoryId: category.id,
          clientId: client?.id ?? null,
          description: dto.description,
          amount: dto.amount,
          dueDate,
          notes: dto.notes ?? null,
        },
        select: {
          id: true,
          description: true,
          amount: true,
          dueDate: true,
          status: true,
          origin: true,
          sourceEntryId: true,
          notes: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const amount = entry.amount.toFixed(2);
      const serializedDueDate = this.formatDate(entry.dueDate);

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'financial_entry.created',
          entityType: 'financial_entry',
          entityId: entry.id,
          metadata: {
            amount,
            dueDate: serializedDueDate,
            categoryId: category.id,
            clientId: client?.id ?? null,
          },
        },
      });

      return {
        ...entry,
        amount,
        dueDate: serializedDueDate,
        period: {
          id: period.id,
          year: period.year,
          month: period.month,
          status: period.status,
        },
        category: {
          id: category.id,
          name: category.name,
          type: category.type,
        },
        client,
      };
    });
  }

  async findAll(
    organizationId: string,
    query: ListEntriesQueryDto,
  ): Promise<PaginatedFinancialEntriesResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const dueFrom = query.dueFrom ? this.parseDate(query.dueFrom) : undefined;
    const dueTo = query.dueTo ? this.parseDate(query.dueTo) : undefined;

    if (dueFrom && dueTo && dueFrom > dueTo) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }

    const where: Prisma.FinancialEntryWhereInput = {
      organizationId,
      ...(query.periodId ? { periodId: query.periodId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryType
        ? {
            category: {
              type: query.categoryType,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                notes: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(dueFrom || dueTo
        ? {
            dueDate: {
              ...(dueFrom ? { gte: dueFrom } : {}),
              ...(dueTo ? { lte: dueTo } : {}),
            },
          }
        : {}),
    };

    const entries = await this.prisma.financialEntry.findMany({
      where,
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        description: true,
        amount: true,
        dueDate: true,
        status: true,
        origin: true,
        sourceEntryId: true,
        notes: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
        period: {
          select: {
            id: true,
            year: true,
            month: true,
            status: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    const total = await this.prisma.financialEntry.count({
      where,
    });

    return {
      data: entries.map((entry) => ({
        ...entry,
        amount: entry.amount.toFixed(2),
        dueDate: this.formatDate(entry.dueDate),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private parseDate(value: string): Date {
    const parsedDate = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      this.formatDate(parsedDate) !== value
    ) {
      throw new BadRequestException('Data de vencimento inválida.');
    }

    return parsedDate;
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
