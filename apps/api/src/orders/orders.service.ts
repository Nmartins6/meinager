import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CreateOrderFromQuoteDto } from './dto/create-order-from-quote.dto.js';
import type { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';
import { OrderStatus, QuoteStatus } from '../generated/prisma/enums.js';

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

const orderSummarySelect = {
  id: true,
  number: true,
  status: true,
  subtotal: true,
  discount: true,
  total: true,
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
  _count: {
    select: {
      items: true,
    },
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

export type OrderSummaryResponse = Prisma.SalesOrderGetPayload<{
  select: typeof orderSummarySelect;
}>;

export interface PaginatedOrdersResponse {
  data: OrderSummaryResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface OrderTransition {
  allowedStatuses: OrderStatus[];
  data: Prisma.SalesOrderUpdateManyMutationInput;
  auditAction: string;
  invalidStatusMessage: string;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(
    organizationId: string,
    orderId: string,
  ): Promise<OrderResponse> {
    const order = await this.prisma.salesOrder.findFirst({
      where: {
        id: orderId,
        organizationId,
      },
      select: orderSelect,
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado.');
    }

    return order;
  }

  async findAll(
    organizationId: string,
    query: ListOrdersQueryDto,
  ): Promise<PaginatedOrdersResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.SalesOrderWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.salesOrder.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: orderSummarySelect,
      }),
      this.prisma.salesOrder.count({
        where,
      }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

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

  async approveArt(
    organizationId: string,
    actorUserId: string,
    orderId: string,
  ): Promise<OrderResponse> {
    return this.transition(organizationId, actorUserId, orderId, {
      allowedStatuses: [OrderStatus.AWAITING_ART_APPROVAL],
      data: {
        status: OrderStatus.AWAITING_RELEASE,
        artApprovedAt: new Date(),
      },
      auditAction: 'order.art_approved',
      invalidStatusMessage:
        'A arte só pode ser aprovada para pedidos aguardando aprovação de arte.',
    });
  }

  async release(
    organizationId: string,
    actorUserId: string,
    orderId: string,
  ): Promise<OrderResponse> {
    return this.transition(organizationId, actorUserId, orderId, {
      allowedStatuses: [OrderStatus.AWAITING_RELEASE],
      data: {
        status: OrderStatus.IN_PRODUCTION,
        releasedAt: new Date(),
      },
      auditAction: 'order.released',
      invalidStatusMessage:
        'O pedido só pode ser liberado para produção quando estiver aguardando liberação.',
    });
  }

  async markReady(
    organizationId: string,
    actorUserId: string,
    orderId: string,
  ): Promise<OrderResponse> {
    return this.transition(organizationId, actorUserId, orderId, {
      allowedStatuses: [OrderStatus.IN_PRODUCTION],
      data: {
        status: OrderStatus.READY,
        readyAt: new Date(),
      },
      auditAction: 'order.ready',
      invalidStatusMessage:
        'O pedido só pode ser marcado como pronto quando estiver em produção.',
    });
  }

  async deliver(
    organizationId: string,
    actorUserId: string,
    orderId: string,
  ): Promise<OrderResponse> {
    return this.transition(organizationId, actorUserId, orderId, {
      allowedStatuses: [OrderStatus.READY],
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(),
      },
      auditAction: 'order.delivered',
      invalidStatusMessage:
        'O pedido só pode ser entregue quando estiver pronto.',
    });
  }

  async cancel(
    organizationId: string,
    actorUserId: string,
    orderId: string,
  ): Promise<OrderResponse> {
    return this.transition(organizationId, actorUserId, orderId, {
      allowedStatuses: [
        OrderStatus.AWAITING_ART_APPROVAL,
        OrderStatus.AWAITING_RELEASE,
        OrderStatus.IN_PRODUCTION,
        OrderStatus.READY,
      ],
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      auditAction: 'order.cancelled',
      invalidStatusMessage:
        'Pedidos entregues ou já cancelados não podem ser cancelados.',
    });
  }

  private async transition(
    organizationId: string,
    actorUserId: string,
    orderId: string,
    transition: OrderTransition,
  ): Promise<OrderResponse> {
    return this.prisma.$transaction(async (transaction) => {
      const currentOrder = await transaction.salesOrder.findFirst({
        where: {
          id: orderId,
          organizationId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!currentOrder) {
        throw new NotFoundException('Pedido não encontrado.');
      }

      if (!transition.allowedStatuses.includes(currentOrder.status)) {
        throw new ConflictException(transition.invalidStatusMessage);
      }

      const updateResult = await transaction.salesOrder.updateMany({
        where: {
          id: currentOrder.id,
          organizationId,
          status: currentOrder.status,
        },
        data: transition.data,
      });

      if (updateResult.count === 0) {
        throw new ConflictException(transition.invalidStatusMessage);
      }

      const order = await transaction.salesOrder.findFirst({
        where: {
          id: currentOrder.id,
          organizationId,
        },
        select: orderSelect,
      });

      if (!order) {
        throw new NotFoundException('Pedido não encontrado.');
      }

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: transition.auditAction,
          entityType: 'sales_order',
          entityId: order.id,
          metadata: {
            previousStatus: currentOrder.status,
            status: order.status,
          },
        },
      });

      return order;
    });
  }
}
