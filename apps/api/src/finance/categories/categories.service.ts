import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { FinancialCategoryType } from '../../generated/prisma/enums.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { ListCategoriesQueryDto } from './dto/list-categories-query.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

export interface FinancialCategoryResponse {
  id: string;
  name: string;
  type: FinancialCategoryType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateCategoryDto,
  ): Promise<FinancialCategoryResponse> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const category = await transaction.financialCategory.create({
          data: {
            organizationId,
            name: dto.name,
            normalizedName: this.normalizeName(dto.name),
            type: dto.type,
          },
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'financial_category.created',
            entityType: 'financial_category',
            entityId: category.id,
          },
        });

        return category;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Já existe uma categoria com este nome e tipo.',
        );
      }

      throw error;
    }
  }

  async findAll(
    organizationId: string,
    query: ListCategoriesQueryDto,
  ): Promise<FinancialCategoryResponse[]> {
    return this.prisma.financialCategory.findMany({
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
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(
    organizationId: string,
    actorUserId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<FinancialCategoryResponse> {
    if (dto.name === undefined && dto.isActive === undefined) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualização.',
      );
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const currentCategory = await transaction.financialCategory.findFirst({
          where: {
            id: categoryId,
            organizationId,
          },
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
          },
        });

        if (!currentCategory) {
          throw new NotFoundException('Categoria financeira não encontrada.');
        }

        const category = await transaction.financialCategory.update({
          where: {
            id: currentCategory.id,
          },
          data: {
            ...(dto.name !== undefined
              ? {
                  name: dto.name,
                  normalizedName: this.normalizeName(dto.name),
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
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'financial_category.updated',
            entityType: 'financial_category',
            entityId: category.id,
            metadata: {
              previous: {
                name: currentCategory.name,
                isActive: currentCategory.isActive,
              },
              current: {
                name: category.name,
                isActive: category.isActive,
              },
            },
          },
        });

        return category;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Já existe uma categoria com este nome e tipo.',
        );
      }

      throw error;
    }
  }

  private normalizeName(name: string): string {
    return name
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
