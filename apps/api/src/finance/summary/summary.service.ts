import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  FinancialCategoryType,
  FinancialEntryStatus,
  FinancialPeriodStatus,
  FinancialRevenueSource,
} from '../../generated/prisma/enums.js';

type FinancialResultStatus = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

interface AggregatedEntries {
  amount: bigint;
  count: number;
}

export interface FinancialPeriodSummaryResponse {
  period: {
    id: string;
    year: number;
    month: number;
    status: FinancialPeriodStatus;
    revenueSource: FinancialRevenueSource;
    manualRevenue: string | null;
  };
  totals: {
    revenue: string;
    fixedExpenses: string;
    variableExpenses: string;
    contributionMargin: string;
    result: string;
    resultStatus: FinancialResultStatus;
  };
  entryCounts: {
    revenue: number;
    fixedExpenses: number;
    variableExpenses: number;
    total: number;
  };
}

@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getPeriodSummary(
    organizationId: string,
    periodId: string,
  ): Promise<FinancialPeriodSummaryResponse> {
    return this.prisma.$transaction(
      async (transaction) => {
        const period = await transaction.financialPeriod.findFirst({
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

        if (!period) {
          throw new NotFoundException('Competência financeira não encontrada.');
        }

        const fixedExpenses = await this.aggregateEntries(
          transaction,
          organizationId,
          period.id,
          FinancialCategoryType.FIXED_EXPENSE,
        );

        const variableExpenses = await this.aggregateEntries(
          transaction,
          organizationId,
          period.id,
          FinancialCategoryType.VARIABLE_EXPENSE,
        );

        let revenue: AggregatedEntries;

        if (period.revenueSource === FinancialRevenueSource.MANUAL_TOTAL) {
          if (period.manualRevenue === null) {
            throw new InternalServerErrorException(
              'A competência possui uma configuração de receita inválida.',
            );
          }

          revenue = {
            amount: this.moneyToMinorUnits(period.manualRevenue.toFixed(2)),
            count: 0,
          };
        } else {
          revenue = await this.aggregateEntries(
            transaction,
            organizationId,
            period.id,
            FinancialCategoryType.REVENUE,
          );
        }

        const contributionMargin = revenue.amount - variableExpenses.amount;
        const result = contributionMargin - fixedExpenses.amount;

        return {
          period: {
            id: period.id,
            year: period.year,
            month: period.month,
            status: period.status,
            revenueSource: period.revenueSource,
            manualRevenue: period.manualRevenue?.toFixed(2) ?? null,
          },
          totals: {
            revenue: this.formatMinorUnits(revenue.amount),
            fixedExpenses: this.formatMinorUnits(fixedExpenses.amount),
            variableExpenses: this.formatMinorUnits(variableExpenses.amount),
            contributionMargin: this.formatMinorUnits(contributionMargin),
            result: this.formatMinorUnits(result),
            resultStatus: this.getResultStatus(result),
          },
          entryCounts: {
            revenue: revenue.count,
            fixedExpenses: fixedExpenses.count,
            variableExpenses: variableExpenses.count,
            total: revenue.count + fixedExpenses.count + variableExpenses.count,
          },
        };
      },
      {
        isolationLevel: 'RepeatableRead',
      },
    );
  }

  private async aggregateEntries(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    periodId: string,
    categoryType: FinancialCategoryType,
  ): Promise<AggregatedEntries> {
    const aggregate = await transaction.financialEntry.aggregate({
      where: {
        organizationId,
        periodId,
        status: {
          not: FinancialEntryStatus.CANCELLED,
        },
        category: {
          type: categoryType,
        },
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      amount: this.moneyToMinorUnits(
        aggregate._sum.amount?.toFixed(2) ?? '0.00',
      ),
      count: aggregate._count.id,
    };
  }

  private moneyToMinorUnits(value: string): bigint {
    const [integerPart, decimalPart = ''] = value.split('.');

    return (
      BigInt(integerPart) * 100n +
      BigInt(decimalPart.padEnd(2, '0').slice(0, 2))
    );
  }

  private formatMinorUnits(value: bigint): string {
    const sign = value < 0n ? '-' : '';
    const absoluteValue = value < 0n ? -value : value;
    const integerPart = absoluteValue / 100n;
    const decimalPart = (absoluteValue % 100n).toString().padStart(2, '0');

    return `${sign}${integerPart}.${decimalPart}`;
  }

  private getResultStatus(value: bigint): FinancialResultStatus {
    if (value > 0n) {
      return 'POSITIVE';
    }

    if (value < 0n) {
      return 'NEGATIVE';
    }

    return 'NEUTRAL';
  }
}
