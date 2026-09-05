import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  FinancialPeriodStatus,
  FinancialRevenueSource,
} from '../../generated/prisma/enums.js';
import type { CreatePeriodDto } from './dto/create-period.dto.js';
import type { ListPeriodsQueryDto } from './dto/list-periods-query.dto.js';
import type { UpdatePeriodDto } from './dto/update-period.dto.js';

export interface FinancialPeriodResponse {
  id: string;
  year: number;
  month: number;
  status: FinancialPeriodStatus;
  revenueSource: FinancialRevenueSource;
  manualRevenue: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreatePeriodDto,
  ): Promise<FinancialPeriodResponse> {
    this.validateRevenueConfiguration(dto);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const period = await transaction.financialPeriod.create({
          data: {
            organizationId,
            year: dto.year,
            month: dto.month,
            revenueSource: dto.revenueSource,
            manualRevenue:
              dto.revenueSource === FinancialRevenueSource.MANUAL_TOTAL
                ? dto.manualRevenue
                : null,
          },
          select: {
            id: true,
            year: true,
            month: true,
            status: true,
            revenueSource: true,
            manualRevenue: true,
            closedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const manualRevenue = period.manualRevenue?.toFixed(2) ?? null;

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'financial_period.created',
            entityType: 'financial_period',
            entityId: period.id,
            metadata: {
              year: period.year,
              month: period.month,
              revenueSource: period.revenueSource,
              manualRevenue,
            },
          },
        });

        return {
          ...period,
          manualRevenue,
        };
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Já existe uma competência financeira para este mês.',
        );
      }

      throw error;
    }
  }

  async findAll(
    organizationId: string,
    query: ListPeriodsQueryDto,
  ): Promise<FinancialPeriodResponse[]> {
    const periods = await this.prisma.financialPeriod.findMany({
      where: {
        organizationId,
        ...(query.year !== undefined ? { year: query.year } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.revenueSource ? { revenueSource: query.revenueSource } : {}),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: {
        id: true,
        year: true,
        month: true,
        status: true,
        revenueSource: true,
        manualRevenue: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return periods.map((period) => ({
      ...period,
      manualRevenue: period.manualRevenue?.toFixed(2) ?? null,
    }));
  }

  private validateRevenueConfiguration(dto: CreatePeriodDto): void {
    if (
      dto.revenueSource === FinancialRevenueSource.MANUAL_TOTAL &&
      dto.manualRevenue === undefined
    ) {
      throw new BadRequestException(
        'Informe a receita manual para esta competência.',
      );
    }

    if (
      dto.revenueSource === FinancialRevenueSource.ENTRIES &&
      dto.manualRevenue !== undefined
    ) {
      throw new BadRequestException(
        'A receita manual não pode ser informada quando a receita vem dos lançamentos.',
      );
    }
  }

  private isUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  async update(
    organizationId: string,
    actorUserId: string,
    periodId: string,
    dto: UpdatePeriodDto,
  ): Promise<FinancialPeriodResponse> {
    if (dto.revenueSource === undefined && dto.manualRevenue === undefined) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualização.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const currentPeriod = await transaction.financialPeriod.findFirst({
        where: {
          id: periodId,
          organizationId,
        },
        select: {
          id: true,
          year: true,
          month: true,
          status: true,
          revenueSource: true,
          manualRevenue: true,
        },
      });

      if (!currentPeriod) {
        throw new NotFoundException('Competência financeira não encontrada.');
      }

      if (currentPeriod.status === FinancialPeriodStatus.CLOSED) {
        throw new BadRequestException(
          'Uma competência fechada não pode ser alterada.',
        );
      }

      const revenueSource = dto.revenueSource ?? currentPeriod.revenueSource;

      let manualRevenue: string | null = null;

      if (revenueSource === FinancialRevenueSource.MANUAL_TOTAL) {
        const configuredRevenue =
          dto.manualRevenue ?? currentPeriod.manualRevenue?.toFixed(2);

        if (configuredRevenue === undefined) {
          throw new BadRequestException(
            'Informe a receita manual para esta competência.',
          );
        }

        const revenueEntryCount = await transaction.financialEntry.count({
          where: {
            organizationId,
            periodId: currentPeriod.id,
            status: {
              not: 'CANCELLED',
            },
            category: {
              type: 'REVENUE',
            },
          },
        });

        if (revenueEntryCount > 0) {
          throw new ConflictException(
            'A competência possui lançamentos de receita e não pode usar receita manual.',
          );
        }

        manualRevenue = configuredRevenue;
      } else if (dto.manualRevenue !== undefined) {
        throw new BadRequestException(
          'A receita manual não pode ser informada quando a receita vem dos lançamentos.',
        );
      }

      const period = await transaction.financialPeriod.update({
        where: {
          id: currentPeriod.id,
        },
        data: {
          revenueSource,
          manualRevenue,
        },
        select: {
          id: true,
          year: true,
          month: true,
          status: true,
          revenueSource: true,
          manualRevenue: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const previousManualRevenue =
        currentPeriod.manualRevenue?.toFixed(2) ?? null;
      const currentManualRevenue = period.manualRevenue?.toFixed(2) ?? null;

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'financial_period.updated',
          entityType: 'financial_period',
          entityId: period.id,
          metadata: {
            previous: {
              revenueSource: currentPeriod.revenueSource,
              manualRevenue: previousManualRevenue,
            },
            current: {
              revenueSource: period.revenueSource,
              manualRevenue: currentManualRevenue,
            },
          },
        },
      });

      return {
        ...period,
        manualRevenue: currentManualRevenue,
      };
    });
  }

  async close(
    organizationId: string,
    actorUserId: string,
    periodId: string,
  ): Promise<FinancialPeriodResponse> {
    return this.prisma.$transaction(async (transaction) => {
      const currentPeriod = await transaction.financialPeriod.findFirst({
        where: {
          id: periodId,
          organizationId,
        },
      });

      if (!currentPeriod) {
        throw new NotFoundException('Competência financeira não encontrada.');
      }

      if (currentPeriod.status === FinancialPeriodStatus.CLOSED) {
        throw new ConflictException(
          'A competência financeira já está fechada.',
        );
      }

      const period = await transaction.financialPeriod.update({
        where: {
          id: currentPeriod.id,
        },
        data: {
          status: FinancialPeriodStatus.CLOSED,
          closedAt: new Date(),
        },
        select: {
          id: true,
          year: true,
          month: true,
          status: true,
          revenueSource: true,
          manualRevenue: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'financial_period.closed',
          entityType: 'financial_period',
          entityId: period.id,
        },
      });

      return {
        ...period,
        manualRevenue: period.manualRevenue?.toFixed(2) ?? null,
      };
    });
  }

  async reopen(
    organizationId: string,
    actorUserId: string,
    periodId: string,
  ): Promise<FinancialPeriodResponse> {
    return this.prisma.$transaction(async (transaction) => {
      const currentPeriod = await transaction.financialPeriod.findFirst({
        where: {
          id: periodId,
          organizationId,
        },
      });

      if (!currentPeriod) {
        throw new NotFoundException('Competência financeira não encontrada.');
      }

      if (currentPeriod.status === FinancialPeriodStatus.OPEN) {
        throw new ConflictException('A competência financeira já está aberta.');
      }

      const period = await transaction.financialPeriod.update({
        where: {
          id: currentPeriod.id,
        },
        data: {
          status: FinancialPeriodStatus.OPEN,
          closedAt: null,
        },
        select: {
          id: true,
          year: true,
          month: true,
          status: true,
          revenueSource: true,
          manualRevenue: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'financial_period.reopened',
          entityType: 'financial_period',
          entityId: period.id,
        },
      });

      return {
        ...period,
        manualRevenue: period.manualRevenue?.toFixed(2) ?? null,
      };
    });
  }
}
