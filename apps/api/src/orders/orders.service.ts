import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  OrderStageCategory,
  OrderStageTransitionType,
  OrderStatus,
  QuoteStatus,
} from '../generated/prisma/enums.js';
import type { CreateOrderFromQuoteDto } from './dto/create-order-from-quote.dto.js';
import type { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';

const orderStageSelect = {
  id: true,
  name: true,
  position: true,
  category: true,
} satisfies Prisma.OrderWorkflowStageSelect;

const orderItemSelect = {
  id: true,
  productId: true,
  priceOrigin: true,
  pricingVersionId: true,
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
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  workflow: {
    select: {
      id: true,
      name: true,
    },
  },
  currentStage: {
    select: orderStageSelect,
  },
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
  stageTransitions: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      type: true,
      createdAt: true,
      previousStage: {
        select: orderStageSelect,
      },
      nextStage: {
        select: orderStageSelect,
      },
      actor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
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
  workflow: {
    select: {
      id: true,
      name: true,
    },
  },
  currentStage: {
    select: orderStageSelect,
  },
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
      priceOrigin: true,
      pricingVersionId: true,
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

function statusForStageCategory(category: OrderStageCategory): OrderStatus {
  switch (category) {
    case OrderStageCategory.PENDING:
      return OrderStatus.PENDING;
    case OrderStageCategory.IN_PROGRESS:
      return OrderStatus.IN_PROGRESS;
    case OrderStageCategory.COMPLETED:
      return OrderStatus.COMPLETED;
  }
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(
    organizationId: string,
    orderId: string,
  ): Promise<OrderResponse> {
    return this.findOrderOrThrow(this.prisma, organizationId, orderId);
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
      this.prisma.salesOrder.count({ where }),
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
        FOR NO KEY UPDATE
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

      const workflow = await transaction.orderWorkflow.findFirst({
        where: {
          organizationId,
          isActive: true,
          ...(dto.workflowId
            ? {
                id: dto.workflowId,
              }
            : {
                isDefault: true,
              }),
        },
        select: {
          id: true,
          name: true,
          stages: {
            where: {
              isActive: true,
            },
            orderBy: {
              position: 'asc',
            },
            take: 1,
            select: orderStageSelect,
          },
        },
      });

      if (!workflow) {
        if (dto.workflowId) {
          throw new NotFoundException(
            'Fluxo de pedidos não encontrado ou inativo.',
          );
        }

        throw new ConflictException(
          'A organização não possui um fluxo padrão ativo.',
        );
      }

      const initialStage = workflow.stages[0];

      if (!initialStage) {
        throw new ConflictException(
          dto.workflowId
            ? 'O fluxo selecionado não possui uma etapa inicial ativa.'
            : 'O fluxo padrão não possui uma etapa inicial ativa.',
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

      const createdOrder = await transaction.salesOrder.create({
        data: {
          organizationId,
          quoteId: quote.id,
          clientId: quote.clientId,
          workflowId: workflow.id,
          currentStageId: initialStage.id,
          status: statusForStageCategory(initialStage.category),
          number: (lastOrder._max.number ?? 0) + 1,
          subtotal: quote.subtotal,
          discount: quote.discount,
          total: quote.total,
          notes: quote.notes,
          items: {
            create: quote.items.map((item) => ({
              productId: item.productId,
              priceOrigin: item.priceOrigin,
              pricingVersionId: item.pricingVersionId,
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
        select: {
          id: true,
        },
      });

      await transaction.salesOrderStageTransition.create({
        data: {
          organizationId,
          orderId: createdOrder.id,
          type: OrderStageTransitionType.CREATED,
          nextStageId: initialStage.id,
          actorUserId,
        },
      });

      const order = await this.findOrderOrThrow(
        transaction,
        organizationId,
        createdOrder.id,
      );

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
            workflowId: workflow.id,
            workflowName: workflow.name,
            initialStageId: initialStage.id,
            initialStageName: initialStage.name,
            itemCount: order.items.length,
            total: order.total.toString(),
          },
        },
      });

      return order;
    });
  }

  async advance(
    organizationId: string,
    actorUserId: string,
    orderId: string,
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
          currentStage: {
            select: orderStageSelect,
          },
          workflow: {
            select: {
              stages: {
                where: {
                  isActive: true,
                },
                orderBy: {
                  position: 'asc',
                },
                select: orderStageSelect,
              },
            },
          },
        },
      });

      if (!currentOrder) {
        throw new NotFoundException('Pedido não encontrado.');
      }

      if (
        currentOrder.status === OrderStatus.COMPLETED ||
        currentOrder.status === OrderStatus.CANCELLED
      ) {
        throw new ConflictException(
          'Pedidos concluídos ou cancelados não podem avançar de etapa.',
        );
      }

      const nextStage = currentOrder.workflow.stages.find(
        (stage) => stage.position > currentOrder.currentStage.position,
      );

      if (!nextStage) {
        throw new ConflictException(
          'Não há uma próxima etapa ativa configurada para este pedido.',
        );
      }

      const nextStatus = statusForStageCategory(nextStage.category);

      const updateResult = await transaction.salesOrder.updateMany({
        where: {
          id: currentOrder.id,
          organizationId,
          status: currentOrder.status,
          currentStageId: currentOrder.currentStage.id,
        },
        data: {
          currentStageId: nextStage.id,
          status: nextStatus,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(
          'O pedido foi alterado por outra operação. Atualize a página e tente novamente.',
        );
      }

      await transaction.salesOrderStageTransition.create({
        data: {
          organizationId,
          orderId: currentOrder.id,
          type: OrderStageTransitionType.ADVANCED,
          previousStageId: currentOrder.currentStage.id,
          nextStageId: nextStage.id,
          actorUserId,
        },
      });

      const order = await this.findOrderOrThrow(
        transaction,
        organizationId,
        currentOrder.id,
      );

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'order.stage_advanced',
          entityType: 'sales_order',
          entityId: order.id,
          metadata: {
            previousStatus: currentOrder.status,
            status: order.status,
            previousStageId: currentOrder.currentStage.id,
            previousStageName: currentOrder.currentStage.name,
            nextStageId: nextStage.id,
            nextStageName: nextStage.name,
          },
        },
      });

      return order;
    });
  }

  async cancel(
    organizationId: string,
    actorUserId: string,
    orderId: string,
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
          currentStage: {
            select: orderStageSelect,
          },
        },
      });

      if (!currentOrder) {
        throw new NotFoundException('Pedido não encontrado.');
      }

      if (
        currentOrder.status === OrderStatus.COMPLETED ||
        currentOrder.status === OrderStatus.CANCELLED
      ) {
        throw new ConflictException(
          'Pedidos concluídos ou já cancelados não podem ser cancelados.',
        );
      }

      const updateResult = await transaction.salesOrder.updateMany({
        where: {
          id: currentOrder.id,
          organizationId,
          status: currentOrder.status,
          currentStageId: currentOrder.currentStage.id,
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(
          'O pedido foi alterado por outra operação. Atualize a página e tente novamente.',
        );
      }

      await transaction.salesOrderStageTransition.create({
        data: {
          organizationId,
          orderId: currentOrder.id,
          type: OrderStageTransitionType.CANCELLED,
          previousStageId: currentOrder.currentStage.id,
          actorUserId,
        },
      });

      const order = await this.findOrderOrThrow(
        transaction,
        organizationId,
        currentOrder.id,
      );

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'order.cancelled',
          entityType: 'sales_order',
          entityId: order.id,
          metadata: {
            previousStatus: currentOrder.status,
            previousStageId: currentOrder.currentStage.id,
            previousStageName: currentOrder.currentStage.name,
          },
        },
      });

      return order;
    });
  }

  private async findOrderOrThrow(
    client: PrismaService | Prisma.TransactionClient,
    organizationId: string,
    orderId: string,
  ): Promise<OrderResponse> {
    const order = await client.salesOrder.findFirst({
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
}
