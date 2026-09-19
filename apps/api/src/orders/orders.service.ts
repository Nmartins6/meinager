import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { QuoteStatus } from '../generated/prisma/enums.js';
import type { CreateOrderFromQuoteDto } from './dto/create-order-from-quote.dto.js';

const orderItemSelect = {
  id: true,
  productId: true,
  position: true,
  description: true,
  unit: true,
  quantity: true,
  unitPrice: true,
  total: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SalesOrderItemSelect;

const orderSelect = {
  id: true,
  number: true,
  status: true,
  subtotal: true,
  discount: true,
  total: true,
  notes: true,
  artApprovedAt: true,
  releasedAt: true,
  readyAt: true,
  deliveredAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  quote: {
    select: {
      id: true,
      number: true,
    },
  },
  client: {
    select: {
      id: true,
      name: true,
      type: true,
    },
  },
  items: {
    orderBy: {
      position: 'asc',
    },
    select: orderItemSelect,
  },
} satisfies Prisma.SalesOrderSelect;

const sourceQuoteSelect = {
  id: true,
  number: true,
  status: true,
  clientId: true,
  subtotal: true,
  discount: true,
  total: true,
  notes: true,
  items: {
    orderBy: {
      position: 'asc',
    },
    select: {
      productId: true,
      position: true,
      description: true,
      unit: true,
      quantity: true,
      unitPrice: true,
      total: true,
      notes: true,
    },
  },
} satisfies Prisma.FinancialQuoteSelect;

export type OrderResponse = Prisma.SalesOrderGetPayload<{
  select: typeof orderSelect;
}>;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromQuote(
    organizationId: string,
    actorUserId: string,
    dto: CreateOrderFromQuoteDto,
  ): Promise<OrderResponse> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "organizations"
        WHERE "id" = ${organizationId}
        FOR UPDATE
      `;

      const existingOrder = await transaction.salesOrder.findFirst({
        where: {
          organizationId,
          quoteId: dto.quoteId,
        },
        select: orderSelect,
      });

      if (existingOrder) {
        return existingOrder;
      }

      const quote = await transaction.financialQuote.findFirst({
        where: {
          id: dto.quoteId,
          organizationId,
        },
        select: sourceQuoteSelect,
      });

      if (!quote) {
        throw new NotFoundException('Orçamento não encontrado.');
      }

      if (quote.status !== QuoteStatus.APPROVED) {
        throw new ConflictException(
          'Apenas orçamentos aprovados podem ser convertidos em pedidos.',
        );
      }

      const lastOrder = await transaction.salesOrder.aggregate({
        where: {
          organizationId,
        },
        _max: {
          number: true,
        },
      });

      const number = (lastOrder._max.number ?? 0) + 1;

      const order = await transaction.salesOrder.create({
        data: {
          organizationId,
          quoteId: quote.id,
          clientId: quote.clientId,
          number,
          subtotal: quote.subtotal,
          discount: quote.discount,
          total: quote.total,
          notes: quote.notes,
          items: {
            create: quote.items.map((item) => ({
              productId: item.productId,
              position: item.position,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              notes: item.notes,
            })),
          },
        },
        select: orderSelect,
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'order.created',
          entityType: 'sales_order',
          entityId: order.id,
          metadata: {
            number: order.number,
            quoteId: quote.id,
            quoteNumber: quote.number,
            clientId: quote.clientId,
            itemCount: order.items.length,
            total: order.total.toString(),
          },
        },
      });

      return order;
    });
  }
}
