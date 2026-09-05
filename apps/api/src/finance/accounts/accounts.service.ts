import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { FinancialAccountType } from '../../generated/prisma/enums.js';
import type { CreateAccountDto } from './dto/create-account.dto.js';
import type { ListAccountsQueryDto } from './dto/list-accounts-query.dto.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';

export interface FinancialAccountResponse {
  id: string;
  name: string;
  type: FinancialAccountType;
  openingBalance: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateAccountDto,
  ): Promise<FinancialAccountResponse> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const account = await transaction.financialAccount.create({
          data: {
            organizationId,
            name: dto.name,
            normalizedName: this.normalizeName(dto.name),
            type: dto.type,
            openingBalance: dto.openingBalance ?? '0',
          },
          select: {
            id: true,
            name: true,
            type: true,
            openingBalance: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const openingBalance = account.openingBalance.toFixed(2);

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'financial_account.created',
            entityType: 'financial_account',
            entityId: account.id,
            metadata: {
              openingBalance,
            },
          },
        });

        return {
          ...account,
          openingBalance,
        };
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Já existe uma conta financeira com este nome.',
        );
      }

      throw error;
    }
  }

  async findAll(
    organizationId: string,
    query: ListAccountsQueryDto,
  ): Promise<FinancialAccountResponse[]> {
    const accounts = await this.prisma.financialAccount.findMany({
      where: {
        organizationId,
        ...(query.type ? { type: query.type } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.search
          ? {
              name: {
                contains: query.search,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        type: true,
        openingBalance: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return accounts.map((account) => ({
      ...account,
      openingBalance: account.openingBalance.toFixed(2),
    }));
  }

  async update(
    organizationId: string,
    actorUserId: string,
    accountId: string,
    dto: UpdateAccountDto,
  ): Promise<FinancialAccountResponse> {
    if (
      dto.name === undefined &&
      dto.openingBalance === undefined &&
      dto.isActive === undefined
    ) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualização.',
      );
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const currentAccount = await transaction.financialAccount.findFirst({
          where: {
            id: accountId,
            organizationId,
          },
          select: {
            id: true,
            name: true,
            type: true,
            openingBalance: true,
            isActive: true,
          },
        });

        if (!currentAccount) {
          throw new NotFoundException('Conta financeira não encontrada.');
        }

        const openingBalanceChanged =
          dto.openingBalance !== undefined &&
          !currentAccount.openingBalance.equals(dto.openingBalance);

        if (openingBalanceChanged) {
          const settlementCount = await transaction.financialSettlement.count({
            where: {
              accountId: currentAccount.id,
            },
          });

          if (settlementCount > 0) {
            throw new BadRequestException(
              'O saldo inicial não pode ser alterado após a primeira movimentação.',
            );
          }
        }

        const account = await transaction.financialAccount.update({
          where: {
            id: currentAccount.id,
          },
          data: {
            ...(dto.name !== undefined
              ? {
                  name: dto.name,
                  normalizedName: this.normalizeName(dto.name),
                }
              : {}),
            ...(openingBalanceChanged
              ? {
                  openingBalance: dto.openingBalance,
                }
              : {}),
            ...(dto.isActive !== undefined
              ? {
                  isActive: dto.isActive,
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            type: true,
            openingBalance: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const previousOpeningBalance = currentAccount.openingBalance.toFixed(2);
        const currentOpeningBalance = account.openingBalance.toFixed(2);

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'financial_account.updated',
            entityType: 'financial_account',
            entityId: account.id,
            metadata: {
              previous: {
                name: currentAccount.name,
                openingBalance: previousOpeningBalance,
                isActive: currentAccount.isActive,
              },
              current: {
                name: account.name,
                openingBalance: currentOpeningBalance,
                isActive: account.isActive,
              },
            },
          },
        });

        return {
          ...account,
          openingBalance: currentOpeningBalance,
        };
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Já existe uma conta financeira com este nome.',
        );
      }

      throw error;
    }
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
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
