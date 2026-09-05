import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  FinancialEntryStatus,
  type FinancialAccountType,
} from '../../generated/prisma/enums.js';
import type { CreateSettlementDto } from './dto/create-settlement.dto.js';
import type { ReverseSettlementDto } from './dto/reverse-settlement.dto.js';

export interface FinancialSettlementItem {
  id: string;
  amount: string;
  settledAt: string;
  notes: string | null;
  reversedAt: Date | null;
  reversalReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  account: {
    id: string;
    name: string;
    type: FinancialAccountType;
  };
}

export interface FinancialEntrySettlementSummary {
  id: string;
  status: FinancialEntryStatus;
  amount: string;
  settledAmount: string;
  remainingAmount: string;
}

export interface FinancialSettlementResponse {
  settlement: FinancialSettlementItem;
  entry: FinancialEntrySettlementSummary;
}

export interface FinancialSettlementsResponse {
  data: FinancialSettlementItem[];
  entry: FinancialEntrySettlementSummary;
}

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    actorUserId: string,
    entryId: string,
    dto: CreateSettlementDto,
  ): Promise<FinancialSettlementResponse> {
    const settledAt = this.parseDate(dto.settledAt);

    return this.prisma.$transaction(async (transaction) => {
      await this.lockEntry(transaction, organizationId, entryId);

      const entry = await transaction.financialEntry.findFirst({
        where: {
          id: entryId,
          organizationId,
        },
        select: {
          id: true,
          amount: true,
          status: true,
        },
      });

      if (!entry) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }

      if (entry.status === FinancialEntryStatus.CANCELLED) {
        throw new BadRequestException(
          'Não é possível registrar uma baixa em um lançamento cancelado.',
        );
      }

      const account = await transaction.financialAccount.findFirst({
        where: {
          id: dto.accountId,
          organizationId,
        },
        select: {
          id: true,
          name: true,
          type: true,
          isActive: true,
        },
      });

      if (!account) {
        throw new NotFoundException('Conta financeira não encontrada.');
      }

      if (!account.isActive) {
        throw new BadRequestException(
          'Não é possível usar uma conta financeira inativa.',
        );
      }

      const activeSettlementAggregate =
        await transaction.financialSettlement.aggregate({
          where: {
            entryId: entry.id,
            reversedAt: null,
          },
          _sum: {
            amount: true,
          },
        });

      const entryAmount = this.moneyToMinorUnits(entry.amount.toFixed(2));
      const previousSettledAmount = this.moneyToMinorUnits(
        activeSettlementAggregate._sum.amount?.toFixed(2) ?? '0.00',
      );
      const settlementAmount = this.moneyToMinorUnits(dto.amount);
      const currentSettledAmount = previousSettledAmount + settlementAmount;

      if (currentSettledAmount > entryAmount) {
        throw new BadRequestException(
          'O valor da baixa ultrapassa o saldo restante do lançamento.',
        );
      }

      const status = this.calculateEntryStatus(
        entryAmount,
        currentSettledAmount,
      );

      const settlement = await transaction.financialSettlement.create({
        data: {
          organizationId,
          entryId: entry.id,
          accountId: account.id,
          amount: dto.amount,
          settledAt,
          notes: dto.notes ?? null,
        },
        select: {
          id: true,
          amount: true,
          settledAt: true,
          notes: true,
          reversedAt: true,
          reversalReason: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await transaction.financialEntry.update({
        where: {
          id: entry.id,
        },
        data: {
          status,
        },
      });

      const serializedAmount = settlement.amount.toFixed(2);
      const serializedSettledAt = this.formatDate(settlement.settledAt);
      const settledAmount = this.formatMinorUnits(currentSettledAmount);
      const remainingAmount = this.formatMinorUnits(
        entryAmount - currentSettledAmount,
      );

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'financial_settlement.created',
          entityType: 'financial_settlement',
          entityId: settlement.id,
          metadata: {
            entryId: entry.id,
            accountId: account.id,
            amount: serializedAmount,
            settledAt: serializedSettledAt,
            previousStatus: entry.status,
            currentStatus: status,
            settledAmount,
            remainingAmount,
          },
        },
      });

      return {
        settlement: {
          ...settlement,
          amount: serializedAmount,
          settledAt: serializedSettledAt,
          account: {
            id: account.id,
            name: account.name,
            type: account.type,
          },
        },
        entry: {
          id: entry.id,
          status,
          amount: this.formatMinorUnits(entryAmount),
          settledAmount,
          remainingAmount,
        },
      };
    });
  }

  async findAll(
    organizationId: string,
    entryId: string,
  ): Promise<FinancialSettlementsResponse> {
    const entry = await this.prisma.financialEntry.findFirst({
      where: {
        id: entryId,
        organizationId,
      },
      select: {
        id: true,
        amount: true,
        status: true,
      },
    });

    if (!entry) {
      throw new NotFoundException('Lançamento financeiro não encontrado.');
    }

    const settlements = await this.prisma.financialSettlement.findMany({
      where: {
        organizationId,
        entryId: entry.id,
      },
      orderBy: [{ settledAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        amount: true,
        settledAt: true,
        notes: true,
        reversedAt: true,
        reversalReason: true,
        createdAt: true,
        updatedAt: true,
        account: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    const activeSettlementAggregate =
      await this.prisma.financialSettlement.aggregate({
        where: {
          organizationId,
          entryId: entry.id,
          reversedAt: null,
        },
        _sum: {
          amount: true,
        },
      });

    const entryAmount = this.moneyToMinorUnits(entry.amount.toFixed(2));
    const settledAmount = this.moneyToMinorUnits(
      activeSettlementAggregate._sum.amount?.toFixed(2) ?? '0.00',
    );

    return {
      data: settlements.map((settlement) => ({
        ...settlement,
        amount: settlement.amount.toFixed(2),
        settledAt: this.formatDate(settlement.settledAt),
      })),
      entry: {
        id: entry.id,
        status: entry.status,
        amount: this.formatMinorUnits(entryAmount),
        settledAmount: this.formatMinorUnits(settledAmount),
        remainingAmount: this.formatMinorUnits(entryAmount - settledAmount),
      },
    };
  }

  async reverse(
    organizationId: string,
    actorUserId: string,
    settlementId: string,
    dto: ReverseSettlementDto,
  ): Promise<FinancialSettlementResponse> {
    return this.prisma.$transaction(async (transaction) => {
      const settlementReference =
        await transaction.financialSettlement.findFirst({
          where: {
            id: settlementId,
            organizationId,
          },
          select: {
            entryId: true,
          },
        });

      if (!settlementReference) {
        throw new NotFoundException('Baixa financeira não encontrada.');
      }

      await this.lockEntry(
        transaction,
        organizationId,
        settlementReference.entryId,
      );

      const currentSettlement = await transaction.financialSettlement.findFirst(
        {
          where: {
            id: settlementId,
            organizationId,
          },
          select: {
            id: true,
            entryId: true,
            accountId: true,
            amount: true,
            settledAt: true,
            notes: true,
            reversedAt: true,
            reversalReason: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      );

      if (!currentSettlement) {
        throw new NotFoundException('Baixa financeira não encontrada.');
      }

      if (currentSettlement.reversedAt) {
        throw new BadRequestException('A baixa financeira já foi estornada.');
      }

      const entry = await transaction.financialEntry.findFirst({
        where: {
          id: currentSettlement.entryId,
          organizationId,
        },
        select: {
          id: true,
          amount: true,
          status: true,
        },
      });

      if (!entry) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }

      const account = await transaction.financialAccount.findFirst({
        where: {
          id: currentSettlement.accountId,
          organizationId,
        },
        select: {
          id: true,
          name: true,
          type: true,
        },
      });

      if (!account) {
        throw new NotFoundException('Conta financeira não encontrada.');
      }

      const reversedAt = new Date();

      const settlement = await transaction.financialSettlement.update({
        where: {
          id: currentSettlement.id,
        },
        data: {
          reversedAt,
          reversalReason: dto.reason,
        },
        select: {
          id: true,
          amount: true,
          settledAt: true,
          notes: true,
          reversedAt: true,
          reversalReason: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const activeSettlementAggregate =
        await transaction.financialSettlement.aggregate({
          where: {
            entryId: entry.id,
            reversedAt: null,
          },
          _sum: {
            amount: true,
          },
        });

      const entryAmount = this.moneyToMinorUnits(entry.amount.toFixed(2));
      const settledAmount = this.moneyToMinorUnits(
        activeSettlementAggregate._sum.amount?.toFixed(2) ?? '0.00',
      );

      const status =
        entry.status === FinancialEntryStatus.CANCELLED
          ? FinancialEntryStatus.CANCELLED
          : this.calculateEntryStatus(entryAmount, settledAmount);

      if (status !== entry.status) {
        await transaction.financialEntry.update({
          where: {
            id: entry.id,
          },
          data: {
            status,
          },
        });
      }

      const serializedAmount = settlement.amount.toFixed(2);
      const serializedSettledAt = this.formatDate(settlement.settledAt);
      const formattedSettledAmount = this.formatMinorUnits(settledAmount);
      const remainingAmount = this.formatMinorUnits(
        entryAmount - settledAmount,
      );

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'financial_settlement.reversed',
          entityType: 'financial_settlement',
          entityId: settlement.id,
          metadata: {
            entryId: entry.id,
            accountId: account.id,
            amount: serializedAmount,
            reason: dto.reason,
            reversedAt: reversedAt.toISOString(),
            previousStatus: entry.status,
            currentStatus: status,
            settledAmount: formattedSettledAmount,
            remainingAmount,
          },
        },
      });

      return {
        settlement: {
          ...settlement,
          amount: serializedAmount,
          settledAt: serializedSettledAt,
          account,
        },
        entry: {
          id: entry.id,
          status,
          amount: this.formatMinorUnits(entryAmount),
          settledAmount: formattedSettledAmount,
          remainingAmount,
        },
      };
    });
  }

  private async lockEntry(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    entryId: string,
  ): Promise<void> {
    await transaction.$queryRaw`
      SELECT "id"
      FROM "financial_entries"
      WHERE "id" = ${entryId}::uuid
        AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `;
  }

  private calculateEntryStatus(
    entryAmount: bigint,
    settledAmount: bigint,
  ): FinancialEntryStatus {
    if (settledAmount === 0n) {
      return FinancialEntryStatus.PENDING;
    }

    if (settledAmount === entryAmount) {
      return FinancialEntryStatus.SETTLED;
    }

    return FinancialEntryStatus.PARTIAL;
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

  private parseDate(value: string): Date {
    const parsedDate = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      this.formatDate(parsedDate) !== value
    ) {
      throw new BadRequestException('Data da baixa inválida.');
    }

    return parsedDate;
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
