import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ProductType } from '../generated/prisma/enums.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';
import { lockProduct } from './lock-product.js';

const productSelect = {
  id: true,
  type: true,
  name: true,
  sku: true,
  barcode: true,
  unit: true,
  directCost: true,
  salePrice: true,
  trackInventory: true,
  minimumStock: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

export type ProductResponse = Prisma.ProductGetPayload<{
  select: typeof productSelect;
}>;

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
          select: productSelect,
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
    productId: string,
  ): Promise<ProductResponse> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        organizationId,
      },
      select: productSelect,
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }

    return product;
  }

  async findAll(
    organizationId: string,
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

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: productSelect,
      }),
      this.prisma.product.count({
        where,
      }),
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
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    const hasChanges = Object.values(dto).some((value) => value !== undefined);

    if (!hasChanges) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar.',
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
          select: productSelect,
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
            ...(dto.salePrice !== undefined
              ? { salePrice: dto.salePrice }
              : {}),
            trackInventory,
            minimumStock,
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
          select: productSelect,
        });

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'product.updated',
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
