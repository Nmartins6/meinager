import { HttpStatus, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  PricingComponentCostSource,
  PricingFreightMode,
} from '../../generated/prisma/enums.js';
import type {
  PricingCompositionComponentDto,
  PricingCompositionParameterOriginsDto,
  PutPricingCompositionDto,
} from '../dto/pricing-composition.dto.js';
import {
  PricingErrorCode,
  PricingHttpException,
} from '../errors/pricing-http.exception.js';
import { serializePricingDecimal } from '../pricing-decimal-serialization.js';

const componentSelect = {
  id: true,
  position: true,
  description: true,
  category: true,
  unit: true,
  quantity: true,
  costSource: true,
  storedUnitCost: true,
  sourceProductId: true,
  originDetails: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PricingComponentSelect;

const compositionSelect = {
  id: true,
  productId: true,
  revision: true,
  profileId: true,
  desiredMargin: true,
  laborEnabled: true,
  timeMinutes: true,
  freightMode: true,
  freightUnitCost: true,
  freightTotalCost: true,
  freightQuantity: true,
  freightConsumedQuantity: true,
  parameterOrigins: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  components: {
    orderBy: { position: 'asc' as const },
    select: componentSelect,
  },
} satisfies Prisma.ProductPricingCompositionSelect;

const productSelect = {
  id: true,
  unit: true,
  directCost: true,
  isActive: true,
} satisfies Prisma.ProductSelect;

type CompositionRecord = Prisma.ProductPricingCompositionGetPayload<{
  select: typeof compositionSelect;
}>;
type ProductRecord = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

interface ResolvedComponent {
  position: number;
  description: string;
  category: PricingCompositionComponentDto['category'];
  unit: string;
  quantity: string;
  costSource: PricingCompositionComponentDto['costSource'];
  storedUnitCost: string | null;
  sourceProductId: string | null;
  originDetails: Prisma.InputJsonObject;
}

interface CompositionState {
  profileId: string | null;
  desiredMargin: string | null;
  laborEnabled: boolean;
  timeMinutes: string | null;
  freightMode: PutPricingCompositionDto['freightMode'];
  freightUnitCost: string | null;
  freightTotalCost: string | null;
  freightQuantity: string | null;
  freightConsumedQuantity: string | null;
  parameterOrigins: Prisma.InputJsonObject;
  components: ResolvedComponent[];
}

const COMPOSITION_PARAMETERS = [
  'desiredMargin',
  'laborEnabled',
  'timeMinutes',
  'freightMode',
  'freightUnitCost',
  'freightTotalCost',
  'freightQuantity',
  'freightConsumedQuantity',
] as const;

type CompositionParameter = (typeof COMPOSITION_PARAMETERS)[number];

@Injectable()
export class PricingCompositionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrent(organizationId: string, productId: string) {
    await this.assertProductExists(this.prisma, organizationId, productId);
    const composition = await this.prisma.productPricingComposition.findFirst({
      where: { organizationId, productId },
      select: compositionSelect,
    });
    if (!composition) throw this.compositionNotFound();
    return this.toResponse(composition);
  }

  async replace(
    organizationId: string,
    actorUserId: string,
    productId: string,
    dto: PutPricingCompositionDto,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (dto.profileId) {
          await this.lockProfile(transaction, organizationId, dto.profileId);
        }

        const productIds = [
          productId,
          ...dto.components.flatMap((item) =>
            item.costSource === PricingComponentCostSource.CATALOG &&
            item.sourceProductId
              ? [item.sourceProductId]
              : [],
          ),
        ]
          .filter((id, index, items) => items.indexOf(id) === index)
          .sort();
        for (const id of productIds) {
          await this.lockProduct(transaction, organizationId, id);
        }

        if (dto.profileId) {
          await this.assertProfileActive(
            transaction,
            organizationId,
            dto.profileId,
          );
        }

        const products = await transaction.product.findMany({
          where: { organizationId, id: { in: productIds } },
          select: productSelect,
        });
        const productsById = new Map(products.map((item) => [item.id, item]));
        const target = productsById.get(productId);
        if (!target) throw this.productNotFound();

        const state = this.buildState(
          dto,
          actorUserId,
          productId,
          productsById,
        );
        const current = await transaction.productPricingComposition.findFirst({
          where: { organizationId, productId },
          select: compositionSelect,
        });

        if (!current) {
          if (dto.expectedRevision !== null) {
            throw this.revisionConflict(dto.expectedRevision, null);
          }
          return this.create(
            transaction,
            organizationId,
            actorUserId,
            productId,
            state,
          );
        }

        if (dto.expectedRevision !== current.revision) {
          throw this.revisionConflict(dto.expectedRevision, current.revision);
        }
        if (this.sameState(current, state)) return this.toResponse(current);

        return this.update(
          transaction,
          organizationId,
          actorUserId,
          current,
          state,
        );
      });
    } catch (error) {
      if (error instanceof PricingHttpException) throw error;
      if (this.isConcurrentModification(error)) {
        throw new PricingHttpException(
          HttpStatus.CONFLICT,
          PricingErrorCode.PRICING_CONCURRENT_MODIFICATION,
          'A composição de precificação foi alterada concorrentemente.',
        );
      }
      throw error;
    }
  }

  private async create(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    productId: string,
    state: CompositionState,
  ) {
    const root = await transaction.productPricingComposition.create({
      data: {
        organizationId,
        productId,
        revision: 1,
        ...this.rootData(state),
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
      select: { id: true },
    });
    await this.createComponents(
      transaction,
      organizationId,
      root.id,
      state.components,
    );
    await this.audit(transaction, organizationId, actorUserId, root.id, {
      operation: 'CREATE',
      productId,
      previousRevision: null,
      newRevision: 1,
      profileId: state.profileId,
      componentCount: state.components.length,
    });
    const composition =
      await transaction.productPricingComposition.findUniqueOrThrow({
        where: { id: root.id },
        select: compositionSelect,
      });
    return this.toResponse(composition);
  }

  private async update(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    current: CompositionRecord,
    state: CompositionState,
  ) {
    const newRevision = current.revision + 1;
    await transaction.productPricingComposition.update({
      where: { id: current.id },
      data: {
        revision: newRevision,
        ...this.rootData(state),
        updatedByUserId: actorUserId,
      },
    });
    await transaction.pricingComponent.deleteMany({
      where: { organizationId, compositionId: current.id },
    });
    await this.createComponents(
      transaction,
      organizationId,
      current.id,
      state.components,
    );
    await this.audit(transaction, organizationId, actorUserId, current.id, {
      operation: 'UPDATE',
      productId: current.productId,
      previousRevision: current.revision,
      newRevision,
      profileId: state.profileId,
      componentCount: state.components.length,
    });
    const composition =
      await transaction.productPricingComposition.findUniqueOrThrow({
        where: { id: current.id },
        select: compositionSelect,
      });
    return this.toResponse(composition);
  }

  private buildState(
    dto: PutPricingCompositionDto,
    actorUserId: string,
    productId: string,
    productsById: Map<string, ProductRecord>,
  ): CompositionState {
    const state: CompositionState = {
      profileId: dto.profileId,
      desiredMargin: this.decimal(dto.desiredMargin),
      laborEnabled: dto.laborEnabled,
      timeMinutes: this.decimal(dto.timeMinutes),
      freightMode: dto.freightMode,
      freightUnitCost: this.decimal(dto.freightUnitCost),
      freightTotalCost: this.decimal(dto.freightTotalCost),
      freightQuantity: this.decimal(dto.freightQuantity),
      freightConsumedQuantity: this.decimal(dto.freightConsumedQuantity),
      parameterOrigins: {},
      components: [],
    };
    this.validateConditionalFields(state);
    state.parameterOrigins = this.resolveParameterOrigins(
      dto.parameterOrigins,
      state,
      actorUserId,
    );
    state.components = dto.components.map((component, index) =>
      this.resolveComponent(
        component,
        index + 1,
        actorUserId,
        productId,
        productsById,
      ),
    );
    return state;
  }

  private resolveComponent(
    item: PricingCompositionComponentDto,
    position: number,
    actorUserId: string,
    productId: string,
    productsById: Map<string, ProductRecord>,
  ): ResolvedComponent {
    let storedUnitCost: string | null = null;
    let sourceProductId: string | null = null;

    if (
      item.costSource === PricingComponentCostSource.MANUAL ||
      item.costSource === PricingComponentCostSource.COPIED
    ) {
      if (item.storedUnitCost == null) {
        throw this.invalidField(
          `components.${position - 1}.storedUnitCost`,
          'O custo unitário persistido é obrigatório para esta origem.',
        );
      }
      if (item.sourceProductId != null) {
        throw this.invalidField(
          `components.${position - 1}.sourceProductId`,
          'A referência de catálogo não é permitida para esta origem.',
        );
      }
      storedUnitCost = this.decimal(item.storedUnitCost);
    } else {
      if (item.storedUnitCost !== undefined) {
        throw this.invalidField(
          `components.${position - 1}.storedUnitCost`,
          'Componentes de catálogo não aceitam custo persistido.',
        );
      }
      if (!item.sourceProductId) {
        throw this.invalidField(
          `components.${position - 1}.sourceProductId`,
          'O produto de catálogo é obrigatório.',
        );
      }
      if (item.sourceProductId === productId) {
        throw this.invalidField(
          `components.${position - 1}.sourceProductId`,
          'Um produto não pode referenciar a si próprio na composição.',
        );
      }
      const source = productsById.get(item.sourceProductId);
      if (!source) throw this.productNotFound();
      if (!source.isActive || source.directCost === null) {
        throw this.invalidField(
          `components.${position - 1}.sourceProductId`,
          'O produto de catálogo deve estar ativo e possuir custo direto.',
        );
      }
      if (this.normalizeUnit(source.unit) !== this.normalizeUnit(item.unit)) {
        throw this.invalidField(
          `components.${position - 1}.unit`,
          'A unidade deve corresponder à unidade do produto de catálogo.',
        );
      }
      sourceProductId = source.id;
    }

    return {
      position,
      description: item.description,
      category: item.category,
      unit: item.unit,
      quantity: this.decimal(item.quantity)!,
      costSource: item.costSource,
      storedUnitCost,
      sourceProductId,
      originDetails: this.originDetails(item.originDetails, actorUserId),
    };
  }

  private validateConditionalFields(state: CompositionState): void {
    if (state.laborEnabled) {
      if (state.timeMinutes === null) {
        throw this.invalidField(
          'timeMinutes',
          'O tempo é obrigatório quando a mão de obra está habilitada.',
        );
      }
    } else if (state.timeMinutes !== null) {
      throw this.invalidField(
        'timeMinutes',
        'O tempo deve ser nulo quando a mão de obra está desabilitada.',
      );
    }

    if (state.freightMode === null) {
      if (
        state.freightUnitCost !== null ||
        state.freightTotalCost !== null ||
        state.freightQuantity !== null ||
        state.freightConsumedQuantity !== null
      ) {
        throw this.invalidField(
          'freightMode',
          'As entradas de frete exigem um modo de frete.',
        );
      }
      return;
    }

    if (state.freightMode === PricingFreightMode.MANUAL) {
      if (
        state.freightUnitCost === null ||
        state.freightTotalCost !== null ||
        state.freightQuantity !== null ||
        state.freightConsumedQuantity !== null
      ) {
        throw this.invalidField(
          'freightUnitCost',
          'O frete manual aceita somente o custo unitário.',
        );
      }
      return;
    }

    if (
      state.freightUnitCost !== null ||
      state.freightTotalCost === null ||
      state.freightQuantity === null
    ) {
      throw this.invalidField(
        'freightTotalCost',
        'O frete rateado exige custo total e quantidade.',
      );
    }
    if (new Prisma.Decimal(state.freightQuantity).isZero()) {
      throw new PricingHttpException(
        HttpStatus.BAD_REQUEST,
        PricingErrorCode.INVALID_FREIGHT_QUANTITY,
        'A quantidade utilizada no rateio do frete deve ser maior que zero.',
        { field: 'freightQuantity' },
      );
    }
  }

  private resolveParameterOrigins(
    origins: PricingCompositionParameterOriginsDto,
    state: CompositionState,
    actorUserId: string,
  ): Prisma.InputJsonObject {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const parameter of COMPOSITION_PARAMETERS) {
      const origin = origins[parameter];
      if (!origin) continue;
      if (!this.parameterIsApplicable(parameter, state)) {
        throw this.invalidField(
          `parameterOrigins.${parameter}`,
          'Não informe proveniência para um parâmetro ausente ou incompatível.',
        );
      }
      result[parameter] = {
        schemaVersion: 1,
        origin: origin.origin,
        source: origin.source ?? null,
        referenceId: origin.referenceId ?? null,
        periodStart: origin.periodStart ?? null,
        periodEnd: origin.periodEnd ?? null,
        criterion: origin.criterion ?? null,
        measuredAt: origin.measuredAt ?? null,
        confirmedByUserId: actorUserId,
      };
    }
    return this.canonicalJson(result as Prisma.InputJsonObject);
  }

  private parameterIsApplicable(
    parameter: CompositionParameter,
    state: CompositionState,
  ): boolean {
    if (parameter === 'laborEnabled') return true;
    if (parameter === 'timeMinutes') return state.laborEnabled;
    if (parameter === 'desiredMargin') return state.desiredMargin !== null;
    if (parameter === 'freightMode') return state.freightMode !== null;
    if (parameter === 'freightUnitCost') {
      return state.freightMode === PricingFreightMode.MANUAL;
    }
    if (parameter === 'freightTotalCost' || parameter === 'freightQuantity') {
      return state.freightMode === PricingFreightMode.ALLOCATED;
    }
    return (
      state.freightMode === PricingFreightMode.ALLOCATED &&
      state.freightConsumedQuantity !== null
    );
  }

  private originDetails(
    details: PricingCompositionComponentDto['originDetails'],
    actorUserId: string,
  ): Prisma.InputJsonObject {
    return {
      schemaVersion: 1,
      source: details?.source ?? null,
      referenceId: details?.referenceId ?? null,
      periodStart: details?.periodStart ?? null,
      periodEnd: details?.periodEnd ?? null,
      criterion: details?.criterion ?? null,
      measuredAt: details?.measuredAt ?? null,
      confirmedByUserId: actorUserId,
    };
  }

  private rootData(state: CompositionState) {
    return {
      profileId: state.profileId,
      desiredMargin: state.desiredMargin,
      laborEnabled: state.laborEnabled,
      timeMinutes: state.timeMinutes,
      freightMode: state.freightMode,
      freightUnitCost: state.freightUnitCost,
      freightTotalCost: state.freightTotalCost,
      freightQuantity: state.freightQuantity,
      freightConsumedQuantity: state.freightConsumedQuantity,
      parameterOrigins: state.parameterOrigins,
    };
  }

  private async createComponents(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    compositionId: string,
    components: ResolvedComponent[],
  ): Promise<void> {
    if (components.length === 0) return;
    await transaction.pricingComponent.createMany({
      data: components.map((component) => ({
        organizationId,
        compositionId,
        ...component,
      })),
    });
  }

  private sameState(
    current: CompositionRecord,
    state: CompositionState,
  ): boolean {
    const rootEqual =
      current.profileId === state.profileId &&
      this.decimalsEqual(current.desiredMargin, state.desiredMargin) &&
      current.laborEnabled === state.laborEnabled &&
      this.decimalsEqual(current.timeMinutes, state.timeMinutes) &&
      current.freightMode === state.freightMode &&
      this.decimalsEqual(current.freightUnitCost, state.freightUnitCost) &&
      this.decimalsEqual(current.freightTotalCost, state.freightTotalCost) &&
      this.decimalsEqual(current.freightQuantity, state.freightQuantity) &&
      this.decimalsEqual(
        current.freightConsumedQuantity,
        state.freightConsumedQuantity,
      ) &&
      this.stableJson(current.parameterOrigins) ===
        this.stableJson(state.parameterOrigins);
    if (!rootEqual || current.components.length !== state.components.length) {
      return false;
    }
    return current.components.every((item, index) => {
      const candidate = state.components[index]!;
      return (
        item.position === candidate.position &&
        item.description === candidate.description &&
        item.category === candidate.category &&
        item.unit === candidate.unit &&
        item.quantity.equals(candidate.quantity) &&
        item.costSource === candidate.costSource &&
        this.decimalsEqual(item.storedUnitCost, candidate.storedUnitCost) &&
        item.sourceProductId === candidate.sourceProductId &&
        this.stableJson(item.originDetails) ===
          this.stableJson(candidate.originDetails)
      );
    });
  }

  private decimalsEqual(
    left: Prisma.Decimal | null,
    right: string | null,
  ): boolean {
    if (left === null || right === null) return left === null && right === null;
    return left.equals(right);
  }

  private decimal(value: string | null): string | null {
    return value === null
      ? null
      : serializePricingDecimal(new Prisma.Decimal(value));
  }

  private normalizeUnit(value: string): string {
    return value.trim().toUpperCase();
  }

  private canonicalJson(value: Prisma.InputJsonObject): Prisma.InputJsonObject {
    return JSON.parse(this.stableJson(value)) as Prisma.InputJsonObject;
  }

  private stableJson(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableJson(item)).join(',')}]`;
    }
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${this.stableJson(item)}`)
      .join(',')}}`;
  }

  private async lockProfile(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    profileId: string,
  ): Promise<void> {
    const profiles = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM public."pricing_sales_profiles"
      WHERE "organization_id" = ${organizationId}::uuid
        AND "id" = ${profileId}::uuid
      FOR UPDATE
    `;
    if (profiles.length === 0) throw this.profileNotFound();
  }

  private async assertProfileActive(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    profileId: string,
  ): Promise<void> {
    const profile = await transaction.pricingSalesProfile.findFirst({
      where: { id: profileId, organizationId },
      select: { isActive: true, currentRevisionId: true },
    });
    if (!profile?.currentRevisionId) throw this.profileNotFound();
    if (!profile.isActive) {
      throw new PricingHttpException(
        HttpStatus.CONFLICT,
        PricingErrorCode.PRICING_PROFILE_INACTIVE,
        'O perfil de venda está inativo.',
      );
    }
  }

  private async lockProduct(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
  ): Promise<void> {
    const products = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM public."products"
      WHERE "organization_id" = ${organizationId}::uuid
        AND "id" = ${productId}::uuid
      FOR UPDATE
    `;
    if (products.length === 0) throw this.productNotFound();
  }

  private async assertProductExists(
    client: Pick<PrismaService, 'product'>,
    organizationId: string,
    productId: string,
  ): Promise<void> {
    const product = await client.product.findFirst({
      where: { id: productId, organizationId },
      select: { id: true },
    });
    if (!product) throw this.productNotFound();
  }

  private audit(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    compositionId: string,
    metadata: Prisma.InputJsonObject,
  ) {
    return transaction.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action: 'product_pricing_composition.updated',
        entityType: 'product_pricing_composition',
        entityId: compositionId,
        metadata,
      },
    });
  }

  private revisionConflict(
    expectedRevision: number | null,
    currentRevision: number | null,
  ) {
    return new PricingHttpException(
      HttpStatus.CONFLICT,
      PricingErrorCode.PRICING_REVISION_CONFLICT,
      'A revisão de precificação foi alterada.',
      {
        field: 'expectedRevision',
        details: { expectedRevision, currentRevision },
      },
    );
  }

  private invalidField(field: string, message: string) {
    return new PricingHttpException(
      HttpStatus.BAD_REQUEST,
      PricingErrorCode.VALIDATION_ERROR,
      message,
      { field },
    );
  }

  private productNotFound() {
    return new PricingHttpException(
      HttpStatus.NOT_FOUND,
      PricingErrorCode.PRODUCT_NOT_FOUND,
      'Produto não encontrado.',
    );
  }

  private profileNotFound() {
    return new PricingHttpException(
      HttpStatus.NOT_FOUND,
      PricingErrorCode.PRICING_PROFILE_NOT_FOUND,
      'Perfil de venda não encontrado.',
    );
  }

  private compositionNotFound() {
    return new PricingHttpException(
      HttpStatus.NOT_FOUND,
      PricingErrorCode.PRICING_COMPOSITION_NOT_FOUND,
      'Composição de precificação não encontrada.',
    );
  }

  private isConcurrentModification(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'P2002' || error.code === 'P2034')
    );
  }

  private toResponse(composition: CompositionRecord) {
    return {
      id: composition.id,
      productId: composition.productId,
      revision: composition.revision,
      profileId: composition.profileId,
      desiredMargin: composition.desiredMargin
        ? serializePricingDecimal(composition.desiredMargin)
        : null,
      laborEnabled: composition.laborEnabled,
      timeMinutes: composition.timeMinutes
        ? serializePricingDecimal(composition.timeMinutes)
        : null,
      freightMode: composition.freightMode,
      freightUnitCost: composition.freightUnitCost
        ? serializePricingDecimal(composition.freightUnitCost)
        : null,
      freightTotalCost: composition.freightTotalCost
        ? serializePricingDecimal(composition.freightTotalCost)
        : null,
      freightQuantity: composition.freightQuantity
        ? serializePricingDecimal(composition.freightQuantity)
        : null,
      freightConsumedQuantity:
        composition.freightConsumedQuantity !== null
          ? serializePricingDecimal(composition.freightConsumedQuantity)
          : null,
      parameterOrigins: composition.parameterOrigins,
      isActive: composition.isActive,
      createdAt: composition.createdAt.toISOString(),
      updatedAt: composition.updatedAt.toISOString(),
      components: composition.components.map((component) => ({
        id: component.id,
        position: component.position,
        description: component.description,
        category: component.category,
        unit: component.unit,
        quantity: serializePricingDecimal(component.quantity),
        costSource: component.costSource,
        storedUnitCost: component.storedUnitCost
          ? serializePricingDecimal(component.storedUnitCost)
          : null,
        sourceProductId: component.sourceProductId,
        originDetails: component.originDetails,
        createdAt: component.createdAt.toISOString(),
        updatedAt: component.updatedAt.toISOString(),
      })),
    };
  }
}
