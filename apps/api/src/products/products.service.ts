import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { OrganizationRole, ProductType } from '../generated/prisma/enums.js';
import {
  PricingErrorCode,
  PricingHttpException,
} from '../pricing/errors/pricing-http.exception.js';
import { serializePricingDecimal } from '../pricing/pricing-decimal-serialization.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';
import { lockProduct } from './lock-product.js';

const productSelectWithoutDirectCost = {
  id: true,
  type: true,
  name: true,
  sku: true,
  barcode: true,
  unit: true,
  salePrice: true,
  trackInventory: true,
  minimumStock: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

const productSelectWithDirectCost = {
  ...productSelectWithoutDirectCost,
  directCost: true,
} satisfies Prisma.ProductSelect;

const productMutationSelect = {
  ...productSelectWithDirectCost,
  adoptedPricingVersionId: true,
} satisfies Prisma.ProductSelect;

type ProductWithoutDirectCostResponse = Prisma.ProductGetPayload<{
  select: typeof productSelectWithoutDirectCost;
}>;

type ProductWithDirectCostResponse = Prisma.ProductGetPayload<{
  select: typeof productSelectWithDirectCost;
}>;

export type ProductResponse =
  ProductWithoutDirectCostResponse | ProductWithDirectCostResponse;

export interface PaginatedProductsResponse {
  data: ProductResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateProductDto,
  ): Promise<ProductResponse> {
    const type = dto.type ?? ProductType.PRODUCT;
    const trackInventory = dto.trackInventory ?? false;
    const minimumStock = dto.minimumStock ?? null;

    this.validateInventoryConfiguration(type, trackInventory, minimumStock);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.create({
          data: {
            organizationId,
            type,
            name: dto.name,
            normalizedName: this.normalizeName(dto.name),
            sku: dto.sku ?? null,
            barcode: dto.barcode ?? null,
            unit: dto.unit,
            directCost: dto.directCost ?? null,
            salePrice: dto.salePrice ?? null,
            trackInventory,
            minimumStock,
            notes: dto.notes ?? null,
          },
          select: productSelectWithDirectCost,
        });

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'product.created',
            entityType: 'product',
            entityId: product.id,
          },
        });

        return product;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Já existe um produto com este SKU ou código de barras.',
        );
      }

      throw error;
    }
  }

  async findOne(
    organizationId: string,
    role: OrganizationRole,
    productId: string,
  ): Promise<ProductResponse> {
    const product =
      role === OrganizationRole.VIEWER
        ? await this.prisma.product.findFirst({
            where: { id: productId, organizationId },
            select: productSelectWithoutDirectCost,
          })
        : await this.prisma.product.findFirst({
            where: { id: productId, organizationId },
            select: productSelectWithDirectCost,
          });

    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }

    return product;
  }

  async findAll(
    organizationId: string,
    role: OrganizationRole,
    query: ListProductsQueryDto,
  ): Promise<PaginatedProductsResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const searchFilters: Prisma.ProductWhereInput[] = query.search
      ? [
          {
            normalizedName: {
              contains: this.normalizeName(query.search),
            },
          },
          {
            sku: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            barcode: {
              contains: query.search,
            },
          },
        ]
      : [];

    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.trackInventory !== undefined
        ? { trackInventory: query.trackInventory }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(searchFilters.length > 0 ? { OR: searchFilters } : {}),
    };

    const pagination = {
      where,
      orderBy: [{ name: 'asc' as const }, { id: 'asc' as const }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
    const count = this.prisma.product.count({ where });
    const [products, total] =
      role === OrganizationRole.VIEWER
        ? await this.prisma.$transaction([
            this.prisma.product.findMany({
              ...pagination,
              select: productSelectWithoutDirectCost,
            }),
            count,
          ])
        : await this.prisma.$transaction([
            this.prisma.product.findMany({
              ...pagination,
              select: productSelectWithDirectCost,
            }),
            count,
          ]);

    return {
      data: products,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async update(
    organizationId: string,
    actorUserId: string,
    role: OrganizationRole,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    const hasChanges = Object.values(dto).some((value) => value !== undefined);

    if (!hasChanges) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar.',
      );
    }

    const changesSalePrice = dto.salePrice !== undefined;

    if (
      changesSalePrice &&
      role !== OrganizationRole.OWNER &&
      role !== OrganizationRole.ADMIN
    ) {
      throw new PricingHttpException(
        HttpStatus.FORBIDDEN,
        PricingErrorCode.PRICING_FORBIDDEN,
        'Seu papel não permite alterar o preço de venda manualmente.',
      );
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockProduct(transaction, organizationId, productId);

        const existingProduct = await transaction.product.findFirst({
          where: {
            id: productId,
            organizationId,
          },
          select: productMutationSelect,
        });

        if (!existingProduct) {
          throw new NotFoundException('Produto não encontrado.');
        }

        const changesInventoryDefinition =
          (dto.unit !== undefined && dto.unit !== existingProduct.unit) ||
          (dto.type !== undefined && dto.type !== existingProduct.type) ||
          (dto.trackInventory !== undefined &&
            dto.trackInventory !== existingProduct.trackInventory);

        if (changesInventoryDefinition) {
          const movement = await transaction.stockMovement.findFirst({
            where: {
              organizationId,
              productId,
            },
            select: {
              id: true,
            },
          });

          if (movement) {
            throw new BadRequestException(
              'Produtos com histórico de estoque não podem alterar unidade, tipo ou controle de estoque.',
            );
          }
        }

        const type = dto.type ?? existingProduct.type;
        const trackInventory =
          dto.trackInventory ?? existingProduct.trackInventory;

        if (
          !trackInventory &&
          dto.minimumStock !== undefined &&
          dto.minimumStock !== null
        ) {
          throw new BadRequestException(
            'O estoque mínimo exige que o controle de estoque esteja habilitado.',
          );
        }

        const requestedMinimumStock =
          dto.minimumStock !== undefined
            ? dto.minimumStock
            : existingProduct.minimumStock;

        const minimumStock = trackInventory ? requestedMinimumStock : null;

        this.validateInventoryConfiguration(type, trackInventory, minimumStock);

        const product = await transaction.product.update({
          where: {
            id: productId,
          },
          data: {
            type,
            ...(dto.name !== undefined
              ? {
                  name: dto.name,
                  normalizedName: this.normalizeName(dto.name),
                }
              : {}),
            ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
            ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
            ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
            ...(dto.directCost !== undefined
              ? { directCost: dto.directCost }
              : {}),
            ...(changesSalePrice
              ? {
                  salePrice: dto.salePrice,
                  adoptedPricingVersionId: null,
                }
              : {}),
            trackInventory,
            minimumStock,
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
          select: productSelectWithDirectCost,
        });

        if (changesSalePrice) {
          await this.auditManualPrice(transaction, {
            organizationId,
            actorUserId,
            productId,
            previousPrice: existingProduct.salePrice,
            newPrice: product.salePrice,
            previousVersionId: existingProduct.adoptedPricingVersionId,
          });
        } else {
          await transaction.auditLog.create({
            data: {
              organizationId,
              actorUserId,
              action: 'product.updated',
              entityType: 'product',
              entityId: product.id,
            },
          });
        }

        return product;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Já existe um produto com este SKU ou código de barras.',
        );
      }

      throw error;
    }
  }

  private validateInventoryConfiguration(
    type: ProductType,
    trackInventory: boolean,
    minimumStock: unknown,
  ): void {
    if (type === ProductType.SERVICE && trackInventory) {
      throw new BadRequestException('Serviços não podem controlar estoque.');
    }

    if (!trackInventory && minimumStock !== null) {
      throw new BadRequestException(
        'O estoque mínimo exige que o controle de estoque esteja habilitado.',
      );
    }
  }

  private auditManualPrice(
    transaction: Prisma.TransactionClient,
    data: {
      organizationId: string;
      actorUserId: string;
      productId: string;
      previousPrice: Prisma.Decimal | null;
      newPrice: Prisma.Decimal | null;
      previousVersionId: string | null;
    },
  ) {
    return transaction.auditLog.create({
      data: {
        organizationId: data.organizationId,
        actorUserId: data.actorUserId,
        action: 'product_price.manually_changed',
        entityType: 'product',
        entityId: data.productId,
        metadata: {
          productId: data.productId,
          previousPrice:
            data.previousPrice === null
              ? null
              : serializePricingDecimal(data.previousPrice),
          newPrice:
            data.newPrice === null
              ? null
              : serializePricingDecimal(data.newPrice),
          previousVersionId: data.previousVersionId,
          pointerCleared: data.previousVersionId !== null,
          actorUserId: data.actorUserId,
        },
      },
    });
  }

  private normalizeName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  }

  private isUniqueConstraintError(error: unknown): error is {
    code: 'P2002';
  } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
