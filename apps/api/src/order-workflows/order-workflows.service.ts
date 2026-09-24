import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { OrderStageCategory } from '../generated/prisma/enums.js';
import type { CreateOrderWorkflowDto } from './dto/create-order-workflow.dto.js';

const workflowStageSelect = {
  id: true,
  name: true,
  position: true,
  category: true,
  isActive: true,
} satisfies Prisma.OrderWorkflowStageSelect;

const workflowSelect = {
  id: true,
  name: true,
  isDefault: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  stages: {
    orderBy: {
      position: 'asc',
    },
    select: workflowStageSelect,
  },
  _count: {
    select: {
      orders: true,
    },
  },
} satisfies Prisma.OrderWorkflowSelect;

export type OrderWorkflowResponse = Prisma.OrderWorkflowGetPayload<{
  select: typeof workflowSelect;
}>;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

function categoryForStage(
  position: number,
  totalStages: number,
): OrderStageCategory {
  if (position === 0) {
    return OrderStageCategory.PENDING;
  }

  if (position === totalStages - 1) {
    return OrderStageCategory.COMPLETED;
  }

  return OrderStageCategory.IN_PROGRESS;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class OrderWorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organizationId: string): Promise<OrderWorkflowResponse[]> {
    return this.prisma.orderWorkflow.findMany({
      where: {
        organizationId,
      },
      orderBy: [
        {
          isDefault: 'desc',
        },
        {
          isActive: 'desc',
        },
        {
          name: 'asc',
        },
      ],
      select: workflowSelect,
    });
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateOrderWorkflowDto,
  ): Promise<OrderWorkflowResponse> {
    const name = dto.name.trim();
    const stageNames = dto.stages.map((stage) => stage.name.trim());
    const normalizedStageNames = stageNames.map(normalize);

    if (new Set(normalizedStageNames).size !== normalizedStageNames.length) {
      throw new ConflictException(
        'As etapas de um fluxo devem possuir nomes diferentes.',
      );
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const workflow = await transaction.orderWorkflow.create({
          data: {
            organizationId,
            name,
            normalizedName: normalize(name),
            stages: {
              create: stageNames.map((stageName, index) => ({
                name: stageName,
                position: index + 1,
                category: categoryForStage(index, stageNames.length),
              })),
            },
          },
          select: workflowSelect,
        });

        await transaction.auditLog.create({
          data: {
            organizationId,
            actorUserId,
            action: 'order_workflow.created',
            entityType: 'order_workflow',
            entityId: workflow.id,
            metadata: {
              name: workflow.name,
              stageCount: workflow.stages.length,
            },
          },
        });

        return workflow;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Já existe um fluxo com este nome na organização.',
        );
      }

      throw error;
    }
  }

  async setDefault(
    organizationId: string,
    actorUserId: string,
    workflowId: string,
  ): Promise<OrderWorkflowResponse> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "organizations"
        WHERE "id" = ${organizationId}
        FOR UPDATE
      `;

      const workflow = await transaction.orderWorkflow.findFirst({
        where: {
          id: workflowId,
          organizationId,
        },
        select: workflowSelect,
      });

      if (!workflow) {
        throw new NotFoundException('Fluxo de pedidos não encontrado.');
      }

      if (!workflow.isActive) {
        throw new ConflictException(
          'Não é possível definir um fluxo desativado como padrão.',
        );
      }

      if (!workflow.stages.some((stage) => stage.isActive)) {
        throw new ConflictException(
          'O fluxo precisa possuir ao menos uma etapa ativa.',
        );
      }

      if (workflow.isDefault) {
        return workflow;
      }

      await transaction.orderWorkflow.updateMany({
        where: {
          organizationId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      const updatedWorkflow = await transaction.orderWorkflow.update({
        where: {
          id: workflow.id,
        },
        data: {
          isDefault: true,
        },
        select: workflowSelect,
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'order_workflow.default_changed',
          entityType: 'order_workflow',
          entityId: updatedWorkflow.id,
          metadata: {
            name: updatedWorkflow.name,
          },
        },
      });

      return updatedWorkflow;
    });
  }

  async deactivate(
    organizationId: string,
    actorUserId: string,
    workflowId: string,
  ): Promise<OrderWorkflowResponse> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "organizations"
        WHERE "id" = ${organizationId}
        FOR UPDATE
      `;

      const workflow = await transaction.orderWorkflow.findFirst({
        where: {
          id: workflowId,
          organizationId,
        },
        select: workflowSelect,
      });

      if (!workflow) {
        throw new NotFoundException('Fluxo de pedidos não encontrado.');
      }

      if (workflow.isDefault) {
        throw new ConflictException(
          'Defina outro fluxo como padrão antes de desativar este.',
        );
      }

      if (!workflow.isActive) {
        return workflow;
      }

      const updatedWorkflow = await transaction.orderWorkflow.update({
        where: {
          id: workflow.id,
        },
        data: {
          isActive: false,
        },
        select: workflowSelect,
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'order_workflow.deactivated',
          entityType: 'order_workflow',
          entityId: updatedWorkflow.id,
          metadata: {
            name: updatedWorkflow.name,
          },
        },
      });

      return updatedWorkflow;
    });
  }
}
