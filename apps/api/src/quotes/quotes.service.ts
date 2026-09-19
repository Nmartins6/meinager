import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { QuoteStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CreateQuoteDto } from './dto/create-quote.dto.js';
import type { ListQuotesQueryDto } from './dto/list-quotes-query.dto.js';
import type { UpdateQuoteDto } from './dto/update-quote.dto.js';

const quoteItemSelect = {
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
} satisfies Prisma.FinancialQuoteItemSelect;

const quoteOrderSelect = {
  id: true,
  number: true,
  status: true,
} satisfies Prisma.SalesOrderSelect;

const quoteSelect = {
  id: true,
  number: true,
  status: true,
  validUntil: true,
  subtotal: true,
  discount: true,
  total: true,
  notes: true,
  sentAt: true,
  approvedAt: true,
  rejectedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
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
    select: quoteItemSelect,
  },
  order: {
    select: quoteOrderSelect,
  },
} satisfies Prisma.FinancialQuoteSelect;

const quoteSummarySelect = {
  id: true,
  number: true,
  status: true,
  validUntil: true,
  subtotal: true,
  discount: true,
  total: true,
  createdAt: true,
  updatedAt: true,
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
  order: {
    select: quoteOrderSelect,
  },
} satisfies Prisma.FinancialQuoteSelect;

export type QuoteResponse = Prisma.FinancialQuoteGetPayload<{
  select: typeof quoteSelect;
}>;

export type QuoteSummaryResponse = Prisma.FinancialQuoteGetPayload<{
  select: typeof quoteSummarySelect;
}>;

export interface PaginatedQuotesResponse {
  data: QuoteSummaryResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateQuoteDto,
  ): Promise<QuoteResponse> {
    return this.prisma.$transaction(async (transaction) => {
      const client = await transaction.client.findFirst({
        where: {
          id: dto.clientId,
          organizationId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!client) {
        throw new NotFoundException('Cliente não encontrado ou está inativo.');
      }

      const productIds = [
        ...new Set(
          dto.items.flatMap((item) => (item.productId ? [item.productId] : [])),
        ),
      ];

      if (productIds.length > 0) {
        const activeProducts = await transaction.product.findMany({
          where: {
            organizationId,
            id: {
              in: productIds,
            },
            isActive: true,
          },
          select: {
            id: true,
          },
        });

        if (activeProducts.length !== productIds.length) {
          throw new BadRequestException(
            'Informe apenas produtos ou serviços ativos da organização.',
          );
        }
      }

      const items = dto.items.map((item) => {
        const quantity = new Prisma.Decimal(item.quantity);
        const unitPrice = new Prisma.Decimal(item.unitPrice);

        const total = quantity
          .mul(unitPrice)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

        return {
          ...item,
          quantity,
          unitPrice,
          total,
        };
      });

      const subtotal = items.reduce(
        (sum, item) => sum.plus(item.total),
        new Prisma.Decimal(0),
      );

      const discount = new Prisma.Decimal(dto.discount ?? '0');

      if (discount.greaterThan(subtotal)) {
        throw new BadRequestException(
          'O desconto não pode ultrapassar o subtotal do orçamento.',
        );
      }

      const total = subtotal.minus(discount);

      await transaction.$queryRaw`
        SELECT "id"
        FROM "organizations"
        WHERE "id" = ${organizationId}
        FOR UPDATE
      `;

      const lastQuote = await transaction.financialQuote.aggregate({
        where: {
          organizationId,
        },
        _max: {
          number: true,
        },
      });

      const number = (lastQuote._max.number ?? 0) + 1;

      const quote = await transaction.financialQuote.create({
        data: {
          organizationId,
          clientId: client.id,
          number,
          validUntil: dto.validUntil
            ? new Date(`${dto.validUntil}T00:00:00.000Z`)
            : null,
          subtotal,
          discount,
          total,
          notes: dto.notes ?? null,
          items: {
            create: items.map((item, index) => ({
              productId: item.productId ?? null,
              position: index + 1,
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              notes: item.notes ?? null,
            })),
          },
        },
        select: quoteSelect,
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'quote.created',
          entityType: 'financial_quote',
          entityId: quote.id,
          metadata: {
            number: quote.number,
            clientId: quote.client.id,
            itemCount: quote.items.length,
            total: total.toString(),
          },
        },
      });

      return quote;
    });
  }

  async update(
    organizationId: string,
    actorUserId: string,
    quoteId: string,
    dto: UpdateQuoteDto,
  ): Promise<QuoteResponse> {
    const hasUpdates =
      dto.clientId !== undefined ||
      dto.validUntil !== undefined ||
      dto.discount !== undefined ||
      dto.notes !== undefined ||
      dto.items !== undefined;

    if (!hasUpdates) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar o orçamento.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
      SELECT "id"
      FROM "financial_quotes"
      WHERE "id" = ${quoteId}
        AND "organization_id" = ${organizationId}
      FOR UPDATE
    `;

      const currentQuote = await transaction.financialQuote.findFirst({
        where: {
          id: quoteId,
          organizationId,
        },
        select: {
          id: true,
          status: true,
          clientId: true,
          validUntil: true,
          discount: true,
          notes: true,
          subtotal: true,
          total: true,
          items: {
            orderBy: {
              position: 'asc',
            },
            select: {
              productId: true,
              description: true,
              unit: true,
              quantity: true,
              unitPrice: true,
              total: true,
              notes: true,
            },
          },
        },
      });

      if (!currentQuote) {
        throw new NotFoundException('Orçamento não encontrado.');
      }

      if (currentQuote.status !== QuoteStatus.DRAFT) {
        throw new ConflictException(
          'Somente orçamentos em rascunho podem ser editados.',
        );
      }

      const clientId = dto.clientId ?? currentQuote.clientId;

      if (dto.clientId !== undefined) {
        const client = await transaction.client.findFirst({
          where: {
            id: clientId,
            organizationId,
            isActive: true,
          },
          select: {
            id: true,
          },
        });

        if (!client) {
          throw new NotFoundException(
            'Cliente não encontrado ou está inativo.',
          );
        }
      }

      if (dto.items !== undefined) {
        const productIds = [
          ...new Set(
            dto.items.flatMap((item) =>
              item.productId ? [item.productId] : [],
            ),
          ),
        ];

        if (productIds.length > 0) {
          const activeProducts = await transaction.product.findMany({
            where: {
              organizationId,
              id: {
                in: productIds,
              },
              isActive: true,
            },
            select: {
              id: true,
            },
          });

          if (activeProducts.length !== productIds.length) {
            throw new BadRequestException(
              'Informe apenas produtos ou serviços ativos da organização.',
            );
          }
        }
      }

      const items =
        dto.items?.map((item) => {
          const quantity = new Prisma.Decimal(item.quantity);
          const unitPrice = new Prisma.Decimal(item.unitPrice);

          return {
            productId: item.productId ?? null,
            description: item.description,
            unit: item.unit,
            quantity,
            unitPrice,
            total: quantity
              .mul(unitPrice)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
            notes: item.notes ?? null,
          };
        }) ??
        currentQuote.items.map((item) => ({
          productId: item.productId,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          notes: item.notes,
        }));

      const subtotal = items.reduce(
        (sum, item) => sum.plus(item.total),
        new Prisma.Decimal(0),
      );

      const discount =
        dto.discount === undefined
          ? currentQuote.discount
          : new Prisma.Decimal(dto.discount ?? '0');

      if (discount.greaterThan(subtotal)) {
        throw new BadRequestException(
          'O desconto não pode ultrapassar o subtotal do orçamento.',
        );
      }

      const total = subtotal.minus(discount);
      const validUntil =
        dto.validUntil === undefined
          ? currentQuote.validUntil
          : dto.validUntil
            ? new Date(`${dto.validUntil}T00:00:00.000Z`)
            : null;

      const notes = dto.notes === undefined ? currentQuote.notes : dto.notes;

      const quote = await transaction.financialQuote.update({
        where: {
          id: currentQuote.id,
        },
        data: {
          clientId,
          validUntil,
          subtotal,
          discount,
          total,
          notes,
          ...(dto.items !== undefined
            ? {
                items: {
                  deleteMany: {},
                  create: items.map((item, index) => ({
                    productId: item.productId,
                    position: index + 1,
                    description: item.description,
                    unit: item.unit,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total,
                    notes: item.notes,
                  })),
                },
              }
            : {}),
        },
        select: quoteSelect,
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'quote.updated',
          entityType: 'financial_quote',
          entityId: quote.id,
          metadata: {
            previous: {
              clientId: currentQuote.clientId,
              itemCount: currentQuote.items.length,
              subtotal: currentQuote.subtotal.toString(),
              discount: currentQuote.discount.toString(),
              total: currentQuote.total.toString(),
            },
            current: {
              clientId: quote.client.id,
              itemCount: quote.items.length,
              subtotal: quote.subtotal.toString(),
              discount: quote.discount.toString(),
              total: quote.total.toString(),
            },
          },
        },
      });

      return quote;
    });
  }

  async send(
    organizationId: string,
    actorUserId: string,
    quoteId: string,
  ): Promise<QuoteResponse> {
    return this.transition(
      organizationId,
      actorUserId,
      quoteId,
      [QuoteStatus.DRAFT],
      QuoteStatus.SENT,
      'sentAt',
      'quote.sent',
      'O orçamento deve estar em rascunho para ser enviado.',
    );
  }

  async approve(
    organizationId: string,
    actorUserId: string,
    quoteId: string,
  ): Promise<QuoteResponse> {
    return this.transition(
      organizationId,
      actorUserId,
      quoteId,
      [QuoteStatus.SENT],
      QuoteStatus.APPROVED,
      'approvedAt',
      'quote.approved',
      'Somente orçamentos enviados podem ser aprovados.',
    );
  }

  async reject(
    organizationId: string,
    actorUserId: string,
    quoteId: string,
  ): Promise<QuoteResponse> {
    return this.transition(
      organizationId,
      actorUserId,
      quoteId,
      [QuoteStatus.SENT],
      QuoteStatus.REJECTED,
      'rejectedAt',
      'quote.rejected',
      'Somente orçamentos enviados podem ser rejeitados.',
    );
  }

  async cancel(
    organizationId: string,
    actorUserId: string,
    quoteId: string,
  ): Promise<QuoteResponse> {
    return this.transition(
      organizationId,
      actorUserId,
      quoteId,
      [QuoteStatus.DRAFT, QuoteStatus.SENT],
      QuoteStatus.CANCELLED,
      'cancelledAt',
      'quote.cancelled',
      'Somente orçamentos em rascunho ou enviados podem ser cancelados.',
    );
  }

  async findOne(
    organizationId: string,
    actorUserId: string,
    quoteId: string,
  ): Promise<QuoteResponse> {
    await this.expireOverdueQuotes(organizationId, actorUserId);

    const quote = await this.prisma.financialQuote.findFirst({
      where: {
        id: quoteId,
        organizationId,
      },
      select: quoteSelect,
    });

    if (!quote) {
      throw new NotFoundException('Orçamento não encontrado.');
    }

    return quote;
  }

  async findAll(
    organizationId: string,
    actorUserId: string,
    query: ListQuotesQueryDto,
  ): Promise<PaginatedQuotesResponse> {
    await this.expireOverdueQuotes(organizationId, actorUserId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.FinancialQuoteWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
    };

    const [quotes, total] = await this.prisma.$transaction([
      this.prisma.financialQuote.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: quoteSummarySelect,
      }),
      this.prisma.financialQuote.count({
        where,
      }),
    ]);

    return {
      data: quotes,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private async transition(
    organizationId: string,
    actorUserId: string,
    quoteId: string,
    allowedStatuses: QuoteStatus[],
    targetStatus: QuoteStatus,
    timestampField: 'sentAt' | 'approvedAt' | 'rejectedAt' | 'cancelledAt',
    action: string,
    invalidStatusMessage: string,
  ): Promise<QuoteResponse> {
    await this.expireOverdueQuotes(organizationId, actorUserId);

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "financial_quotes"
        WHERE "id" = ${quoteId}
          AND "organization_id" = ${organizationId}
        FOR UPDATE
      `;

      const currentQuote = await transaction.financialQuote.findFirst({
        where: {
          id: quoteId,
          organizationId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!currentQuote) {
        throw new NotFoundException('Orçamento não encontrado.');
      }

      if (!allowedStatuses.includes(currentQuote.status)) {
        throw new ConflictException(invalidStatusMessage);
      }

      const quote = await transaction.financialQuote.update({
        where: {
          id: currentQuote.id,
        },
        data: {
          status: targetStatus,
          ...this.statusTimestamp(timestampField, new Date()),
        },
        select: quoteSelect,
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action,
          entityType: 'financial_quote',
          entityId: quote.id,
          metadata: {
            previousStatus: currentQuote.status,
            currentStatus: quote.status,
          },
        },
      });

      return quote;
    });
  }

  private async expireOverdueQuotes(
    organizationId: string,
    actorUserId: string,
  ): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await this.prisma.$transaction(async (transaction) => {
      const overdueQuotes = await transaction.financialQuote.findMany({
        where: {
          organizationId,
          status: QuoteStatus.SENT,
          validUntil: {
            lt: today,
          },
        },
        select: {
          id: true,
        },
      });

      for (const quote of overdueQuotes) {
        const result = await transaction.financialQuote.updateMany({
          where: {
            id: quote.id,
            organizationId,
            status: QuoteStatus.SENT,
          },
          data: {
            status: QuoteStatus.EXPIRED,
          },
        });

        if (result.count === 0) {
          continue;
        }

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'quote.expired',
            entityType: 'financial_quote',
            entityId: quote.id,
            metadata: {
              previousStatus: QuoteStatus.SENT,
              currentStatus: QuoteStatus.EXPIRED,
            },
          },
        });
      }
    });
  }

  private statusTimestamp(
    field: 'sentAt' | 'approvedAt' | 'rejectedAt' | 'cancelledAt',
    timestamp: Date,
  ): Prisma.FinancialQuoteUpdateInput {
    switch (field) {
      case 'sentAt':
        return { sentAt: timestamp };
      case 'approvedAt':
        return { approvedAt: timestamp };
      case 'rejectedAt':
        return { rejectedAt: timestamp };
      case 'cancelledAt':
        return { cancelledAt: timestamp };
    }
  }
}
