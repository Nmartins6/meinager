import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ProductType,
  StockMovementOrigin,
  StockMovementType,
} from '../generated/prisma/enums.js';
import { lockProduct } from '../products/lock-product.js';
import type { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import type { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto.js';
import type { ReverseStockMovementDto } from './dto/reverse-stock-movement.dto.js';
import type { AdjustStockDto } from './dto/adjust-stock.dto.js';

const movementSelect = {
  id: true,
  productId: true,
  type: true,
  origin: true,
  quantity: true,
  reason: true,
  notes: true,
  reversalOfId: true,
  occurredAt: true,
  createdAt: true,
} satisfies Prisma.StockMovementSelect;

type SelectedMovement = Prisma.StockMovementGetPayload<{
  select: typeof movementSelect;
}>;

export type StockMovementResponse = Omit<SelectedMovement, 'quantity'> & {
  quantity: string;
};

interface StockTotals {
  totalIn: string;
  totalOut: string;
  balance: string;
}

export interface StockBalanceResponse extends StockTotals {
  productId: string;
  unit: string;
  trackInventory: boolean;
  minimumStock: string | null;
  isBelowMinimum: boolean;
}

export interface PaginatedStockMovementsResponse {
  data: StockMovementResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface StockAdjustmentResponse {
  productId: string;
  previousBalance: string;
  balance: string;
  movement: StockMovementResponse | null;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    actorUserId: string,
    productId: string,
    dto: CreateStockMovementDto,
  ): Promise<StockMovementResponse> {
    const quantity = new Prisma.Decimal(dto.quantity);

    if (!quantity.isFinite() || quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'A quantidade deve ser maior que zero.',
      );
    }

    return this.prisma.$transaction(
      async (transaction) => {
        await lockProduct(transaction, organizationId, productId);

        const product = await this.findProduct(
          transaction,
          organizationId,
          productId,
        );

        if (!product.isActive) {
          throw new BadRequestException(
            'Produtos inativos não podem receber movimentações.',
          );
        }

        if (
          product.type !== ProductType.PRODUCT ||
          !product.trackInventory
        ) {
          throw new BadRequestException(
            'O produto deve ter o controle de estoque habilitado.',
          );
        }

        const totals = await this.calculateTotals(
          transaction,
          organizationId,
          productId,
        );

        if (
          dto.type === StockMovementType.OUT &&
          quantity.greaterThan(totals.balance)
        ) {
          throw new ConflictException(
            'Saldo de estoque insuficiente para esta saída.',
          );
        }

        const movement = await transaction.stockMovement.create({
          data: {
            organizationId,
            productId,
            type: dto.type,
            origin: StockMovementOrigin.MANUAL,
            quantity,
            reason: dto.reason,
            notes: dto.notes ?? null,
            occurredAt: new Date(),
          },
          select: movementSelect,
        });

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'stock_movement.created',
            entityType: 'stock_movement',
            entityId: movement.id,
            metadata: {
              productId,
              type: movement.type,
              origin: movement.origin,
              quantity: quantity.toString(),
              reason: movement.reason,
            },
          },
        });

        return this.toResponse(movement);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

    async reverse(
    organizationId: string,
    actorUserId: string,
    productId: string,
    movementId: string,
    dto: ReverseStockMovementDto,
  ): Promise<StockMovementResponse> {
    return this.prisma.$transaction(
      async (transaction) => {
        await lockProduct(transaction, organizationId, productId);

        const original = await transaction.stockMovement.findFirst({
          where: {
            id: movementId,
            organizationId,
            productId,
          },
          select: movementSelect,
        });

        if (!original) {
          throw new NotFoundException(
            'Movimentação de estoque não encontrada.',
          );
        }

        if (original.origin === StockMovementOrigin.REVERSAL) {
          throw new BadRequestException(
            'Não é possível estornar uma movimentação de estorno.',
          );
        }

        const existingReversal = await transaction.stockMovement.findFirst({
          where: {
            organizationId,
            productId,
            reversalOfId: original.id,
          },
          select: {
            id: true,
          },
        });

        if (existingReversal) {
          throw new ConflictException(
            'Esta movimentação já foi estornada.',
          );
        }

        const reversalType =
          original.type === StockMovementType.IN
            ? StockMovementType.OUT
            : StockMovementType.IN;

        const totals = await this.calculateTotals(
          transaction,
          organizationId,
          productId,
        );

        if (
          reversalType === StockMovementType.OUT &&
          original.quantity.greaterThan(totals.balance)
        ) {
          throw new ConflictException(
            'Saldo de estoque insuficiente para estornar esta entrada.',
          );
        }

        const reversal = await transaction.stockMovement.create({
          data: {
            organizationId,
            productId,
            type: reversalType,
            origin: StockMovementOrigin.REVERSAL,
            quantity: original.quantity,
            reason: dto.reason,
            notes: dto.notes ?? null,
            reversalOfId: original.id,
            occurredAt: new Date(),
          },
          select: movementSelect,
        });

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'stock_movement.reversed',
            entityType: 'stock_movement',
            entityId: original.id,
            metadata: {
              productId,
              reversalId: reversal.id,
              originalType: original.type,
              reversalType: reversal.type,
              quantity: original.quantity.toString(),
              reason: reversal.reason,
            },
          },
        });

        return this.toResponse(reversal);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

    async adjust(
    organizationId: string,
    actorUserId: string,
    productId: string,
    dto: AdjustStockDto,
  ): Promise<StockAdjustmentResponse> {
    const countedQuantity = new Prisma.Decimal(dto.countedQuantity);
    const expectedBalance = new Prisma.Decimal(dto.expectedBalance);

    if (
      !countedQuantity.isFinite() ||
      countedQuantity.isNegative() ||
      !expectedBalance.isFinite() ||
      expectedBalance.isNegative()
    ) {
      throw new BadRequestException(
        'A contagem e o saldo esperado devem ser não negativos.',
      );
    }

    return this.prisma.$transaction(
      async (transaction) => {
        await lockProduct(transaction, organizationId, productId);

        const product = await this.findProduct(
          transaction,
          organizationId,
          productId,
        );

        if (!product.isActive) {
          throw new BadRequestException(
            'Produtos inativos não podem receber ajustes de estoque.',
          );
        }

        if (
          product.type !== ProductType.PRODUCT ||
          !product.trackInventory
        ) {
          throw new BadRequestException(
            'O produto deve ter o controle de estoque habilitado.',
          );
        }

        const totals = await this.calculateTotals(
          transaction,
          organizationId,
          productId,
        );

        const currentBalance = new Prisma.Decimal(totals.balance);

        if (!currentBalance.equals(expectedBalance)) {
          throw new ConflictException(
            'O saldo de estoque mudou. Atualize os dados e confira a contagem antes de tentar novamente.',
          );
        }

        const difference = countedQuantity.minus(currentBalance);

        if (difference.isZero()) {
          return {
            productId,
            previousBalance: currentBalance.toString(),
            balance: currentBalance.toString(),
            movement: null,
          };
        }

        const quantity = difference.abs();

        if (quantity.greaterThan('999999999999.999999')) {
          throw new BadRequestException(
            'A diferença excede o limite permitido por movimentação.',
          );
        }

        const movement = await transaction.stockMovement.create({
          data: {
            organizationId,
            productId,
            type: difference.isPositive()
              ? StockMovementType.IN
              : StockMovementType.OUT,
            origin: StockMovementOrigin.ADJUSTMENT,
            quantity,
            reason: dto.reason,
            notes: dto.notes ?? null,
            occurredAt: new Date(),
          },
          select: movementSelect,
        });

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'stock_movement.adjusted',
            entityType: 'stock_movement',
            entityId: movement.id,
            metadata: {
              productId,
              type: movement.type,
              origin: movement.origin,
              quantity: quantity.toString(),
              previousBalance: currentBalance.toString(),
              countedQuantity: countedQuantity.toString(),
              expectedBalance: expectedBalance.toString(),
              reason: movement.reason,
            },
          },
        });

        return {
          productId,
          previousBalance: currentBalance.toString(),
          balance: countedQuantity.toString(),
          movement: this.toResponse(movement),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  async findAll(
    organizationId: string,
    productId: string,
    query: ListStockMovementsQueryDto,
  ): Promise<PaginatedStockMovementsResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.StockMovementWhereInput = {
      organizationId,
      productId,
      ...(query.type !== undefined ? { type: query.type } : {}),
      ...(query.origin !== undefined ? { origin: query.origin } : {}),
    };

    return this.prisma.$transaction(
      async (transaction) => {
        await this.findProduct(
          transaction,
          organizationId,
          productId,
        );

        const movements = await transaction.stockMovement.findMany({
          where,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: movementSelect,
        });

        const total = await transaction.stockMovement.count({
          where,
        });

        return {
          data: movements.map((movement) => this.toResponse(movement)),
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }

  async getBalance(
    organizationId: string,
    productId: string,
  ): Promise<StockBalanceResponse> {
    return this.prisma.$transaction(
      async (transaction) => {
        const product = await this.findProduct(
          transaction,
          organizationId,
          productId,
        );

        const totals = await this.calculateTotals(
          transaction,
          organizationId,
          productId,
        );

        return {
          productId: product.id,
          unit: product.unit,
          trackInventory: product.trackInventory,
          minimumStock: product.minimumStock?.toString() ?? null,
          ...totals,
          isBelowMinimum:
            product.trackInventory &&
            product.minimumStock !== null &&
            new Prisma.Decimal(totals.balance).lessThan(
              product.minimumStock,
            ),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }

  private async findProduct(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
  ) {
    const product = await transaction.product.findFirst({
      where: {
        id: productId,
        organizationId,
      },
      select: {
        id: true,
        type: true,
        unit: true,
        isActive: true,
        trackInventory: true,
        minimumStock: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }

    return product;
  }

  private async calculateTotals(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
  ): Promise<StockTotals> {
    const rows = await transaction.$queryRaw<StockTotals[]>`
      SELECT
        COALESCE(
          SUM("quantity") FILTER (WHERE "type" = 'IN'),
          0
        )::text AS "totalIn",
        COALESCE(
          SUM("quantity") FILTER (WHERE "type" = 'OUT'),
          0
        )::text AS "totalOut",
        COALESCE(
          SUM(
            CASE
              WHEN "type" = 'IN' THEN "quantity"
              ELSE -"quantity"
            END
          ),
          0
        )::text AS "balance"
      FROM "stock_movements"
      WHERE "organization_id" = ${organizationId}::uuid
        AND "product_id" = ${productId}::uuid
    `;

    const totals = rows[0];

    if (!totals) {
      throw new Error('Stock totals query returned no result');
    }

    return {
      totalIn: new Prisma.Decimal(totals.totalIn).toString(),
      totalOut: new Prisma.Decimal(totals.totalOut).toString(),
      balance: new Prisma.Decimal(totals.balance).toString(),
    };
  }

  private toResponse(
    movement: SelectedMovement,
  ): StockMovementResponse {
    return {
      ...movement,
      quantity: movement.quantity.toString(),
    };
  }
}