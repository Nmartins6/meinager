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
  FinancialEntryOrigin,
  FinancialEntryStatus,
  FinancialPeriodStatus,
  FinancialRevenueSource,
} from '../../generated/prisma/enums.js';
import type { ClientType } from '../../generated/prisma/enums.js';
import type { CreateEntryDto } from './dto/create-entry.dto.js';
import type { ListEntriesQueryDto } from './dto/list-entries-query.dto.js';
import type { UpdateEntryDto } from './dto/update-entry.dto.js';
import type { CancelEntryDto } from './dto/cancel-entry.dto.js';

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

  async findOne(
    organizationId: string,
    entryId: string,
  ): Promise<FinancialEntryResponse> {
    const entry = await this.prisma.financialEntry.findFirst({
      where: {
        id: entryId,
        organizationId,
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

    if (!entry) {
      throw new NotFoundException('Lançamento financeiro não encontrado.');
    }

    return {
      ...entry,
      amount: entry.amount.toFixed(2),
      dueDate: this.formatDate(entry.dueDate),
    };
  }

  async update(
    organizationId: string,
    actorUserId: string,
    entryId: string,
    dto: UpdateEntryDto,
  ): Promise<FinancialEntryResponse> {
    if (
      dto.categoryId === undefined &&
      dto.clientId === undefined &&
      dto.description === undefined &&
      dto.amount === undefined &&
      dto.dueDate === undefined &&
      dto.notes === undefined
    ) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualização.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const currentEntry = await transaction.financialEntry.findFirst({
        where: {
          id: entryId,
          organizationId,
        },
        select: {
          id: true,
          periodId: true,
          categoryId: true,
          clientId: true,
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

      if (!currentEntry) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }

      if (currentEntry.status === FinancialEntryStatus.CANCELLED) {
        throw new BadRequestException(
          'Não é possível alterar um lançamento cancelado.',
        );
      }

      const period = await transaction.financialPeriod.findFirst({
        where: {
          id: currentEntry.periodId,
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
          'Não é possível alterar lançamentos de uma competência fechada.',
        );
      }

      if (dto.amount !== undefined || dto.categoryId !== undefined) {
        const activeSettlementCount =
          await transaction.financialSettlement.count({
            where: {
              entryId: currentEntry.id,
              reversedAt: null,
            },
          });

        if (activeSettlementCount > 0) {
          throw new BadRequestException(
            'Não é possível alterar o valor ou a categoria de um lançamento com pagamentos.',
          );
        }
      }

      const dueDate =
        dto.dueDate !== undefined
          ? this.parseDate(dto.dueDate)
          : currentEntry.dueDate;

      if (
        dueDate.getUTCFullYear() !== period.year ||
        dueDate.getUTCMonth() + 1 !== period.month
      ) {
        throw new BadRequestException(
          'A data de vencimento deve pertencer à competência informada.',
        );
      }

      const categoryId = dto.categoryId ?? currentEntry.categoryId;
      const category = await transaction.financialCategory.findFirst({
        where: {
          id: categoryId,
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

      if (dto.categoryId !== undefined && !category.isActive) {
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

      const clientId =
        dto.clientId !== undefined ? dto.clientId : currentEntry.clientId;

      if (clientId) {
        const selectedClient = await transaction.client.findFirst({
          where: {
            id: clientId,
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

        if (dto.clientId !== undefined && !selectedClient.isActive) {
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

      const entry = await transaction.financialEntry.update({
        where: {
          id: currentEntry.id,
        },
        data: {
          ...(dto.categoryId !== undefined
            ? { categoryId: dto.categoryId }
            : {}),
          ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
          ...(dto.dueDate !== undefined ? { dueDate } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
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
          action: 'financial_entry.updated',
          entityType: 'financial_entry',
          entityId: entry.id,
          metadata: {
            previous: {
              categoryId: currentEntry.categoryId,
              clientId: currentEntry.clientId,
              description: currentEntry.description,
              amount: currentEntry.amount.toFixed(2),
              dueDate: this.formatDate(currentEntry.dueDate),
              notes: currentEntry.notes,
            },
            current: {
              categoryId: category.id,
              clientId: client?.id ?? null,
              description: entry.description,
              amount,
              dueDate: serializedDueDate,
              notes: entry.notes,
            },
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

  async cancel(
    organizationId: string,
    actorUserId: string,
    entryId: string,
    dto: CancelEntryDto,
  ): Promise<FinancialEntryResponse> {
    await this.prisma.$transaction(async (transaction) => {
      const currentEntry = await transaction.financialEntry.findFirst({
        where: {
          id: entryId,
          organizationId,
        },
        select: {
          id: true,
          periodId: true,
          status: true,
        },
      });

      if (!currentEntry) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }

      if (currentEntry.status === FinancialEntryStatus.CANCELLED) {
        throw new BadRequestException(
          'O lançamento financeiro já está cancelado.',
        );
      }

      const period = await transaction.financialPeriod.findFirst({
        where: {
          id: currentEntry.periodId,
          organizationId,
        },
        select: {
          status: true,
        },
      });

      if (!period) {
        throw new NotFoundException('Competência financeira não encontrada.');
      }

      if (period.status === FinancialPeriodStatus.CLOSED) {
        throw new BadRequestException(
          'Não é possível cancelar lançamentos de uma competência fechada.',
        );
      }

      const activeSettlementCount = await transaction.financialSettlement.count(
        {
          where: {
            entryId: currentEntry.id,
            reversedAt: null,
          },
        },
      );

      if (activeSettlementCount > 0) {
        throw new BadRequestException(
          'Estorne os pagamentos antes de cancelar o lançamento.',
        );
      }

      const cancelledAt = new Date();

      await transaction.financialEntry.update({
        where: {
          id: currentEntry.id,
        },
        data: {
          status: FinancialEntryStatus.CANCELLED,
          cancelledAt,
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'financial_entry.cancelled',
          entityType: 'financial_entry',
          entityId: currentEntry.id,
          metadata: {
            reason: dto.reason,
            previousStatus: currentEntry.status,
            currentStatus: FinancialEntryStatus.CANCELLED,
            cancelledAt: cancelledAt.toISOString(),
          },
        },
      });
    });

    return this.findOne(organizationId, entryId);
  }

  async duplicateToNextMonth(
    organizationId: string,
    actorUserId: string,
    entryId: string,
  ): Promise<FinancialEntryResponse> {
    return this.prisma.$transaction(async (transaction) => {
      const sourceEntry = await transaction.financialEntry.findFirst({
        where: {
          id: entryId,
          organizationId,
        },
        select: {
          id: true,
          periodId: true,
          categoryId: true,
          clientId: true,
          description: true,
          amount: true,
          dueDate: true,
          status: true,
          notes: true,
        },
      });

      if (!sourceEntry) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }

      if (sourceEntry.status === FinancialEntryStatus.CANCELLED) {
        throw new BadRequestException(
          'Não é possível duplicar um lançamento cancelado.',
        );
      }

      const sourcePeriod = await transaction.financialPeriod.findFirst({
        where: {
          id: sourceEntry.periodId,
          organizationId,
        },
        select: {
          id: true,
          year: true,
          month: true,
          status: true,
        },
      });

      if (!sourcePeriod) {
        throw new NotFoundException('Competência financeira não encontrada.');
      }

      if (sourcePeriod.status === FinancialPeriodStatus.CLOSED) {
        throw new BadRequestException(
          'Não é possível duplicar lançamentos de uma competência fechada.',
        );
      }

      const category = await transaction.financialCategory.findFirst({
        where: {
          id: sourceEntry.categoryId,
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

      if (category.type !== FinancialCategoryType.FIXED_EXPENSE) {
        throw new BadRequestException(
          'Somente despesas fixas podem ser duplicadas para o mês seguinte.',
        );
      }

      if (!category.isActive) {
        throw new BadRequestException(
          'Não é possível duplicar um lançamento com categoria inativa.',
        );
      }

      let client: {
        id: string;
        name: string;
        type: ClientType;
      } | null = null;

      if (sourceEntry.clientId) {
        const selectedClient = await transaction.client.findFirst({
          where: {
            id: sourceEntry.clientId,
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
            'Não é possível duplicar um lançamento com cliente inativo.',
          );
        }

        client = {
          id: selectedClient.id,
          name: selectedClient.name,
          type: selectedClient.type,
        };
      }

      if (sourcePeriod.year === 9999 && sourcePeriod.month === 12) {
        throw new BadRequestException(
          'Não existe uma competência posterior válida.',
        );
      }

      const targetYear =
        sourcePeriod.month === 12 ? sourcePeriod.year + 1 : sourcePeriod.year;

      const targetMonth =
        sourcePeriod.month === 12 ? 1 : sourcePeriod.month + 1;

      const targetPeriod = await transaction.financialPeriod.findFirst({
        where: {
          organizationId,
          year: targetYear,
          month: targetMonth,
        },
        select: {
          id: true,
          year: true,
          month: true,
          status: true,
        },
      });

      if (!targetPeriod) {
        throw new NotFoundException(
          'A competência financeira do mês seguinte não foi encontrada.',
        );
      }

      if (targetPeriod.status === FinancialPeriodStatus.CLOSED) {
        throw new BadRequestException(
          'Não é possível duplicar o lançamento para uma competência fechada.',
        );
      }

      const existingDuplicate = await transaction.financialEntry.findFirst({
        where: {
          organizationId,
          periodId: targetPeriod.id,
          sourceEntryId: sourceEntry.id,
          origin: FinancialEntryOrigin.DUPLICATED,
          status: {
            not: FinancialEntryStatus.CANCELLED,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingDuplicate) {
        throw new ConflictException(
          'Este lançamento já foi duplicado para a competência seguinte.',
        );
      }

      const sourceDay = sourceEntry.dueDate.getUTCDate();
      const lastTargetDay = new Date(
        Date.UTC(targetYear, targetMonth, 0),
      ).getUTCDate();
      const targetDay = Math.min(sourceDay, lastTargetDay);
      const dueDate = new Date(
        Date.UTC(targetYear, targetMonth - 1, targetDay),
      );

      const entry = await transaction.financialEntry.create({
        data: {
          organizationId,
          periodId: targetPeriod.id,
          categoryId: category.id,
          clientId: client?.id ?? null,
          sourceEntryId: sourceEntry.id,
          description: sourceEntry.description,
          amount: sourceEntry.amount,
          dueDate,
          origin: FinancialEntryOrigin.DUPLICATED,
          notes: sourceEntry.notes,
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
          action: 'financial_entry.duplicated',
          entityType: 'financial_entry',
          entityId: entry.id,
          metadata: {
            sourceEntryId: sourceEntry.id,
            sourcePeriodId: sourcePeriod.id,
            targetPeriodId: targetPeriod.id,
            amount,
            dueDate: serializedDueDate,
          },
        },
      });

      return {
        ...entry,
        amount,
        dueDate: serializedDueDate,
        period: {
          id: targetPeriod.id,
          year: targetPeriod.year,
          month: targetPeriod.month,
          status: targetPeriod.status,
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
