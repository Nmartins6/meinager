import { HttpStatus, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  PricingComponentCostSource,
  PricingFixedCostMode,
  PricingFreightMode,
  PricingParameterOrigin,
} from '../../generated/prisma/enums.js';
import { PricingCalculatorError } from '../calculator/pricing-calculator.errors.js';
import { calculatePricing } from '../calculator/pricing-calculator.js';
import type {
  PricingCalculatorInput,
  PricingCalculatorResult,
  PricingComponentInput,
  PricingParameterOrigin as CalculatorParameterOrigin,
} from '../calculator/pricing-calculator.types.js';
import type { PricingCompositionComponentDto } from '../dto/pricing-composition.dto.js';
import {
  PricingSimulationSource,
  type CreatePricingSimulationDto,
  type PricingSimulationDraftDto,
} from '../dto/pricing-simulation.dto.js';
import {
  PricingErrorCode,
  PricingHttpException,
} from '../errors/pricing-http.exception.js';
import { serializePricingDecimal } from '../pricing-decimal-serialization.js';

const configurationSelect = {
  id: true,
  isActive: true,
  currentRevision: {
    select: {
      id: true,
      revision: true,
      effectiveFrom: true,
      currency: true,
      fixedCostMode: true,
      fixedCostRate: true,
      monthlyFixedCost: true,
      averageMonthlyRevenue: true,
      monthlyLaborCost: true,
      productiveHours: true,
      defaultDesiredMargin: true,
      parameterOrigins: true,
    },
  },
} satisfies Prisma.OrganizationPricingConfigurationSelect;

const compositionSelect = {
  id: true,
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
  components: {
    orderBy: { position: 'asc' as const },
    select: {
      position: true,
      description: true,
      category: true,
      unit: true,
      quantity: true,
      costSource: true,
      storedUnitCost: true,
      sourceProductId: true,
      originDetails: true,
    },
  },
} satisfies Prisma.ProductPricingCompositionSelect;

const productSelect = {
  id: true,
  type: true,
  name: true,
  unit: true,
  directCost: true,
  isActive: true,
} satisfies Prisma.ProductSelect;

const profileSelect = {
  id: true,
  isActive: true,
  currentRevision: {
    select: {
      id: true,
      revision: true,
      name: true,
      deductions: {
        orderBy: { position: 'asc' as const },
        select: {
          position: true,
          name: true,
          category: true,
          rate: true,
          origin: true,
          originDetails: true,
        },
      },
    },
  },
} satisfies Prisma.PricingSalesProfileSelect;

type ConfigurationRecord = Prisma.OrganizationPricingConfigurationGetPayload<{
  select: typeof configurationSelect;
}>;
type CompositionRecord = Prisma.ProductPricingCompositionGetPayload<{
  select: typeof compositionSelect;
}>;
type ProductRecord = Prisma.ProductGetPayload<{ select: typeof productSelect }>;
type ProfileRecord = Prisma.PricingSalesProfileGetPayload<{
  select: typeof profileSelect;
}>;

interface SimulationComposition {
  readonly id: string | null;
  readonly revision: number | null;
  readonly profileId: string | null;
  readonly desiredMargin: string | null;
  readonly laborEnabled: boolean;
  readonly timeMinutes: string | null;
  readonly freightMode: PricingFreightMode | null;
  readonly freightUnitCost: string | null;
  readonly freightTotalCost: string | null;
  readonly freightQuantity: string | null;
  readonly freightConsumedQuantity: string | null;
  readonly parameterOrigins: unknown;
  readonly components: readonly SimulationComponent[];
}

interface SimulationComponent {
  readonly position: number;
  readonly description: string;
  readonly category: PricingCompositionComponentDto['category'];
  readonly unit: string;
  readonly quantity: string;
  readonly costSource: PricingComponentCostSource;
  readonly storedUnitCost: string | null;
  readonly sourceProductId: string | null;
  readonly originDetails: unknown;
}

export interface PricingPersistedCalculation {
  readonly response: PricingSimulationResponse;
  readonly records: {
    readonly target: ProductRecord;
    readonly configuration: ConfigurationRecord;
    readonly composition: SimulationComposition & {
      readonly id: string;
      readonly revision: number;
    };
    readonly profile: ProfileRecord | null;
  };
}

export interface PricingSimulationResponse {
  readonly productId: string;
  readonly source: CreatePricingSimulationDto['source'];
  readonly compositionRevision: number | null;
  readonly configuration: {
    readonly id: string;
    readonly revisionId: string;
    readonly revision: number;
  };
  readonly profile: {
    readonly id: string;
    readonly revisionId: string;
    readonly revision: number;
    readonly name: string;
  } | null;
  readonly effectiveDesiredMargin: {
    readonly value: string;
    readonly precedence: 'COMPOSITION' | 'CONFIGURATION';
    readonly origin: CalculatorParameterOrigin | null;
  };
  readonly resolvedInput: PricingCalculatorInput;
  readonly result: PricingCalculatorResult;
  readonly formulaVersion: PricingCalculatorResult['formulaVersion'];
  readonly adoptedPrice: string | null;
}

@Injectable()
export class PricingCalculationsService {
  constructor(private readonly prisma: PrismaService) {}

  async simulate(
    organizationId: string,
    actorUserId: string,
    productId: string,
    dto: CreatePricingSimulationDto,
  ): Promise<PricingSimulationResponse> {
    void actorUserId;
    this.validateSource(dto);

    try {
      return await this.prisma.$transaction(
        async (transaction) =>
          this.simulateInTransaction(
            transaction,
            organizationId,
            productId,
            dto,
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    } catch (error) {
      if (
        error instanceof PricingHttpException ||
        error instanceof PricingCalculatorError
      ) {
        if (error instanceof PricingCalculatorError) {
          throw this.calculatorError(error);
        }
        throw error;
      }
      if (this.isConcurrentModification(error)) {
        throw new PricingHttpException(
          HttpStatus.CONFLICT,
          PricingErrorCode.PRICING_CONCURRENT_MODIFICATION,
          'Os dados de precificação foram alterados concorrentemente.',
        );
      }
      throw error;
    }
  }

  private async simulateInTransaction(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
    dto: CreatePricingSimulationDto,
  ): Promise<PricingSimulationResponse> {
    if (dto.source === PricingSimulationSource.PERSISTED) {
      return (
        await this.resolvePersistedInTransaction(
          transaction,
          organizationId,
          productId,
          dto.adoptedPrice,
        )
      ).response;
    }

    const target = await transaction.product.findFirst({
      where: { id: productId, organizationId },
      select: productSelect,
    });
    if (!target) throw this.productNotFound();

    const configuration =
      await transaction.organizationPricingConfiguration.findUnique({
        where: { organizationId },
        select: configurationSelect,
      });
    if (!configuration?.isActive || configuration.currentRevision === null) {
      throw this.configurationRequired();
    }

    const composition = this.fromDraft(dto.draft!);
    this.validateComposition(composition);

    const profile = composition.profileId
      ? await this.readProfile(
          transaction,
          organizationId,
          composition.profileId,
        )
      : null;
    const products = await this.readCatalogProducts(
      transaction,
      organizationId,
      productId,
      composition.components,
    );
    const resolvedInput = this.buildInput(
      configuration,
      composition,
      profile,
      products,
      dto.adoptedPrice,
    );
    const result = calculatePricing(resolvedInput);
    const marginPrecedence =
      composition.desiredMargin === null ? 'CONFIGURATION' : 'COMPOSITION';
    const marginOrigins =
      composition.desiredMargin === null
        ? configuration.currentRevision.parameterOrigins
        : composition.parameterOrigins;

    return {
      productId,
      source: dto.source,
      compositionRevision: composition.revision,
      configuration: {
        id: configuration.id,
        revisionId: configuration.currentRevision.id,
        revision: configuration.currentRevision.revision,
      },
      profile: profile?.currentRevision
        ? {
            id: profile.id,
            revisionId: profile.currentRevision.id,
            revision: profile.currentRevision.revision,
            name: profile.currentRevision.name,
          }
        : null,
      effectiveDesiredMargin: {
        value: resolvedInput.desiredMargin,
        precedence: marginPrecedence,
        origin: this.readOrigin(
          marginOrigins,
          marginPrecedence === 'COMPOSITION'
            ? 'desiredMargin'
            : 'defaultDesiredMargin',
        ),
      },
      resolvedInput,
      result,
      formulaVersion: result.formulaVersion,
      adoptedPrice: result.adoptedPrice,
    };
  }

  async resolvePersistedInTransaction(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
    adoptedPrice?: string,
  ): Promise<PricingPersistedCalculation> {
    const target = await transaction.product.findFirst({
      where: { id: productId, organizationId },
      select: productSelect,
    });
    if (!target) throw this.productNotFound();

    const configuration =
      await transaction.organizationPricingConfiguration.findUnique({
        where: { organizationId },
        select: configurationSelect,
      });
    if (!configuration?.isActive || configuration.currentRevision === null) {
      throw this.configurationRequired();
    }

    const composition = await this.readPersistedComposition(
      transaction,
      organizationId,
      productId,
    );
    this.validateComposition(composition);
    const profile = composition.profileId
      ? await this.readProfile(
          transaction,
          organizationId,
          composition.profileId,
        )
      : null;
    const products = await this.readCatalogProducts(
      transaction,
      organizationId,
      productId,
      composition.components,
    );
    const resolvedInput = this.buildInput(
      configuration,
      composition,
      profile,
      products,
      adoptedPrice,
    );
    const result = calculatePricing(resolvedInput);
    const marginPrecedence =
      composition.desiredMargin === null ? 'CONFIGURATION' : 'COMPOSITION';
    const marginOrigins =
      composition.desiredMargin === null
        ? configuration.currentRevision.parameterOrigins
        : composition.parameterOrigins;
    const response: PricingSimulationResponse = {
      productId,
      source: PricingSimulationSource.PERSISTED,
      compositionRevision: composition.revision,
      configuration: {
        id: configuration.id,
        revisionId: configuration.currentRevision.id,
        revision: configuration.currentRevision.revision,
      },
      profile: profile?.currentRevision
        ? {
            id: profile.id,
            revisionId: profile.currentRevision.id,
            revision: profile.currentRevision.revision,
            name: profile.currentRevision.name,
          }
        : null,
      effectiveDesiredMargin: {
        value: resolvedInput.desiredMargin,
        precedence: marginPrecedence,
        origin: this.readOrigin(
          marginOrigins,
          marginPrecedence === 'COMPOSITION'
            ? 'desiredMargin'
            : 'defaultDesiredMargin',
        ),
      },
      resolvedInput,
      result,
      formulaVersion: result.formulaVersion,
      adoptedPrice: result.adoptedPrice,
    };
    if (response.effectiveDesiredMargin.origin === null) {
      throw this.invalidField(
        `parameterOrigins.${
          marginPrecedence === 'COMPOSITION'
            ? 'desiredMargin'
            : 'defaultDesiredMargin'
        }`,
        'A margem efetiva exige proveniência.',
      );
    }
    return {
      response,
      records: {
        target,
        configuration,
        composition: composition as SimulationComposition & {
          id: string;
          revision: number;
        },
        profile,
      },
    };
  }

  private async readPersistedComposition(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
  ): Promise<SimulationComposition> {
    const record = await transaction.productPricingComposition.findFirst({
      where: { organizationId, productId, isActive: true },
      select: compositionSelect,
    });
    if (!record) throw this.compositionNotFound();
    return this.fromRecord(record);
  }

  private fromRecord(record: CompositionRecord): SimulationComposition {
    return {
      id: record.id,
      revision: record.revision,
      profileId: record.profileId,
      desiredMargin: this.decimal(record.desiredMargin),
      laborEnabled: record.laborEnabled,
      timeMinutes: this.decimal(record.timeMinutes),
      freightMode: record.freightMode,
      freightUnitCost: this.decimal(record.freightUnitCost),
      freightTotalCost: this.decimal(record.freightTotalCost),
      freightQuantity: this.decimal(record.freightQuantity),
      freightConsumedQuantity: this.decimal(record.freightConsumedQuantity),
      parameterOrigins: record.parameterOrigins,
      components: record.components.map((component) => ({
        position: component.position,
        description: component.description,
        category: component.category,
        unit: component.unit,
        quantity: serializePricingDecimal(component.quantity),
        costSource: component.costSource,
        storedUnitCost: this.decimal(component.storedUnitCost),
        sourceProductId: component.sourceProductId,
        originDetails: component.originDetails,
      })),
    };
  }

  private fromDraft(draft: PricingSimulationDraftDto): SimulationComposition {
    return {
      id: null,
      revision: null,
      profileId: draft.profileId,
      desiredMargin: this.inputDecimal(draft.desiredMargin),
      laborEnabled: draft.laborEnabled,
      timeMinutes: this.inputDecimal(draft.timeMinutes),
      freightMode: draft.freightMode,
      freightUnitCost: this.inputDecimal(draft.freightUnitCost),
      freightTotalCost: this.inputDecimal(draft.freightTotalCost),
      freightQuantity: this.inputDecimal(draft.freightQuantity),
      freightConsumedQuantity: this.inputDecimal(draft.freightConsumedQuantity),
      parameterOrigins: draft.parameterOrigins,
      components: draft.components.map((component, index) => ({
        position: index + 1,
        description: component.description,
        category: component.category,
        unit: component.unit,
        quantity: this.inputDecimal(component.quantity)!,
        costSource: component.costSource,
        storedUnitCost: this.inputDecimal(component.storedUnitCost ?? null),
        sourceProductId: component.sourceProductId ?? null,
        originDetails: component.originDetails ?? null,
      })),
    };
  }

  private async readProfile(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    profileId: string,
  ): Promise<ProfileRecord> {
    const profile = await transaction.pricingSalesProfile.findFirst({
      where: { id: profileId, organizationId },
      select: profileSelect,
    });
    if (!profile?.currentRevision) throw this.profileNotFound();
    if (!profile.isActive) {
      throw new PricingHttpException(
        HttpStatus.CONFLICT,
        PricingErrorCode.PRICING_PROFILE_INACTIVE,
        'O perfil de venda está inativo.',
      );
    }
    return profile;
  }

  private async readCatalogProducts(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    targetProductId: string,
    components: readonly SimulationComponent[],
  ): Promise<Map<string, ProductRecord>> {
    const ids = components
      .filter(
        (component) =>
          component.costSource === PricingComponentCostSource.CATALOG,
      )
      .map((component) => component.sourceProductId)
      .filter((id): id is string => id !== null)
      .filter((id, index, values) => values.indexOf(id) === index)
      .sort();
    if (ids.includes(targetProductId)) {
      throw this.invalidField(
        'components.sourceProductId',
        'Um produto não pode referenciar a si próprio na composição.',
      );
    }
    if (ids.length === 0) return new Map();
    const products = await transaction.product.findMany({
      where: { organizationId, id: { in: ids } },
      select: productSelect,
      orderBy: { id: 'asc' },
    });
    if (products.length !== ids.length) throw this.productNotFound();
    return new Map(products.map((product) => [product.id, product]));
  }

  private buildInput(
    configuration: ConfigurationRecord,
    composition: SimulationComposition,
    profile: ProfileRecord | null,
    products: Map<string, ProductRecord>,
    adoptedPrice: string | undefined,
  ): PricingCalculatorInput {
    const revision = configuration.currentRevision!;
    if (revision.currency !== 'BRL') {
      throw new PricingCalculatorError(
        'UNSUPPORTED_CURRENCY',
        'currency',
        'A moeda operacional deve ser BRL.',
      );
    }
    const desiredMargin =
      composition.desiredMargin ?? this.decimal(revision.defaultDesiredMargin);
    if (desiredMargin === null) {
      throw this.invalidField(
        'desiredMargin',
        'Informe uma margem na composição ou na configuração.',
      );
    }

    return {
      currency: 'BRL',
      components: composition.components.map((component) =>
        this.resolveComponent(component, products),
      ),
      ...(composition.laborEnabled
        ? { labor: this.resolveLabor(revision, composition) }
        : {}),
      ...(composition.freightMode === null
        ? {}
        : { freight: this.resolveFreight(composition) }),
      ...this.resolveFixedCosts(revision),
      deductions:
        profile?.currentRevision?.deductions.map((deduction) => ({
          name: deduction.name,
          category: deduction.category,
          rate: serializePricingDecimal(deduction.rate),
          origin: deduction.origin,
        })) ?? [],
      desiredMargin,
      ...(adoptedPrice === undefined
        ? {}
        : { adoptedPrice: this.inputDecimal(adoptedPrice)! }),
    };
  }

  private resolveComponent(
    component: SimulationComponent,
    products: Map<string, ProductRecord>,
  ): PricingComponentInput {
    if (component.costSource === PricingComponentCostSource.CATALOG) {
      const source = component.sourceProductId
        ? products.get(component.sourceProductId)
        : undefined;
      if (!source) throw this.productNotFound();
      if (!source.isActive || source.directCost === null) {
        throw this.invalidField(
          `components.${component.position - 1}.sourceProductId`,
          'O produto de catálogo deve estar ativo e possuir custo direto.',
        );
      }
      if (
        this.normalizeUnit(source.unit) !== this.normalizeUnit(component.unit)
      ) {
        throw this.invalidField(
          `components.${component.position - 1}.unit`,
          'A unidade deve corresponder à unidade do produto de catálogo.',
        );
      }
      return {
        description: component.description,
        category: component.category,
        unit: component.unit,
        quantity: component.quantity,
        unitCost: serializePricingDecimal(source.directCost),
        origin: 'CATALOG',
        productId: source.id,
      };
    }

    if (component.storedUnitCost === null) {
      throw this.invalidField(
        `components.${component.position - 1}.storedUnitCost`,
        'O custo unitário persistido é obrigatório para esta origem.',
      );
    }
    return {
      description: component.description,
      category: component.category,
      unit: component.unit,
      quantity: component.quantity,
      unitCost: component.storedUnitCost,
      origin: component.costSource,
    };
  }

  private resolveLabor(
    revision: NonNullable<ConfigurationRecord['currentRevision']>,
    composition: SimulationComposition,
  ) {
    if (
      revision.productiveHours === null ||
      revision.monthlyLaborCost === null
    ) {
      throw new PricingHttpException(
        HttpStatus.BAD_REQUEST,
        PricingErrorCode.INVALID_PRODUCTIVE_HOURS,
        'A configuração de mão de obra exige custo mensal e horas produtivas.',
        { field: 'labor.productiveHours' },
      );
    }
    if (composition.timeMinutes === null) {
      throw this.invalidField(
        'timeMinutes',
        'O tempo é obrigatório quando a mão de obra está habilitada.',
      );
    }
    return {
      monthlyCost: serializePricingDecimal(revision.monthlyLaborCost),
      productiveHours: serializePricingDecimal(revision.productiveHours),
      timeMinutes: composition.timeMinutes,
    };
  }

  private resolveFreight(
    composition: SimulationComposition,
  ): NonNullable<PricingCalculatorInput['freight']> {
    if (composition.freightMode === PricingFreightMode.MANUAL) {
      if (composition.freightUnitCost === null) {
        throw this.invalidField(
          'freightUnitCost',
          'O frete manual exige custo unitário.',
        );
      }
      return { mode: 'MANUAL', unitCost: composition.freightUnitCost };
    }
    if (
      composition.freightTotalCost === null ||
      composition.freightQuantity === null
    ) {
      throw this.invalidField(
        'freightTotalCost',
        'O frete rateado exige custo total e quantidade.',
      );
    }
    return {
      mode: 'ALLOCATED',
      totalCost: composition.freightTotalCost,
      quantity: composition.freightQuantity,
      ...(composition.freightConsumedQuantity === null
        ? {}
        : { consumedQuantity: composition.freightConsumedQuantity }),
    };
  }

  private resolveFixedCosts(
    revision: NonNullable<ConfigurationRecord['currentRevision']>,
  ): Pick<PricingCalculatorInput, 'fixedCosts'> | Record<string, never> {
    if (revision.fixedCostMode === null) return {};
    if (revision.fixedCostMode === PricingFixedCostMode.RATE) {
      if (revision.fixedCostRate === null) {
        throw this.invalidField(
          'fixedCostRate',
          'A configuração por taxa exige o percentual de custo fixo.',
        );
      }
      return {
        fixedCosts: {
          mode: 'RATE',
          rate: serializePricingDecimal(revision.fixedCostRate),
          origin: this.requiredOrigin(
            revision.parameterOrigins,
            'fixedCostRate',
          ),
        },
      };
    }
    if (
      revision.monthlyFixedCost === null ||
      revision.averageMonthlyRevenue === null
    ) {
      throw this.invalidField(
        'monthlyFixedCost',
        'A configuração mensal exige custo fixo e faturamento médio.',
      );
    }
    return {
      fixedCosts: {
        mode: 'MONTHLY',
        monthlyCost: serializePricingDecimal(revision.monthlyFixedCost),
        averageRevenue: serializePricingDecimal(revision.averageMonthlyRevenue),
        origin: this.requiredOrigin(
          revision.parameterOrigins,
          'monthlyFixedCost',
        ),
      },
    };
  }

  private validateSource(dto: CreatePricingSimulationDto): void {
    if (
      dto.source === PricingSimulationSource.PERSISTED &&
      dto.draft !== undefined
    ) {
      throw this.invalidField(
        'draft',
        'A fonte persistida não aceita uma composição de rascunho.',
      );
    }
  }

  private validateComposition(composition: SimulationComposition): void {
    if (composition.laborEnabled !== (composition.timeMinutes !== null)) {
      throw this.invalidField(
        'timeMinutes',
        'O tempo deve corresponder ao estado da mão de obra.',
      );
    }
    if (composition.freightMode === null) {
      if (
        composition.freightUnitCost !== null ||
        composition.freightTotalCost !== null ||
        composition.freightQuantity !== null ||
        composition.freightConsumedQuantity !== null
      ) {
        throw this.invalidField(
          'freightMode',
          'As entradas de frete exigem um modo de frete.',
        );
      }
    } else if (composition.freightMode === PricingFreightMode.MANUAL) {
      if (
        composition.freightUnitCost === null ||
        composition.freightTotalCost !== null ||
        composition.freightQuantity !== null ||
        composition.freightConsumedQuantity !== null
      ) {
        throw this.invalidField(
          'freightUnitCost',
          'O frete manual aceita somente o custo unitário.',
        );
      }
    } else if (
      composition.freightUnitCost !== null ||
      composition.freightTotalCost === null ||
      composition.freightQuantity === null
    ) {
      throw this.invalidField(
        'freightTotalCost',
        'O frete rateado exige custo total e quantidade.',
      );
    }

    for (const component of composition.components) {
      const field = `components.${component.position - 1}`;
      if (component.costSource === PricingComponentCostSource.CATALOG) {
        if (component.storedUnitCost !== null || !component.sourceProductId) {
          throw this.invalidField(
            `${field}.sourceProductId`,
            'Componentes de catálogo exigem somente o produto de origem.',
          );
        }
      } else if (
        component.storedUnitCost === null ||
        component.sourceProductId !== null
      ) {
        throw this.invalidField(
          `${field}.storedUnitCost`,
          'Componentes manuais e copiados exigem somente o custo persistido.',
        );
      }
    }
  }

  private requiredOrigin(
    origins: unknown,
    parameter: string,
  ): CalculatorParameterOrigin {
    const origin = this.readOrigin(origins, parameter);
    if (origin === null) {
      throw this.invalidField(
        `parameterOrigins.${parameter}`,
        'A configuração não possui a proveniência necessária para o cálculo.',
      );
    }
    return origin;
  }

  private readOrigin(
    origins: unknown,
    parameter: string,
  ): CalculatorParameterOrigin | null {
    if (!origins || Array.isArray(origins) || typeof origins !== 'object') {
      return null;
    }
    const details = (origins as Record<string, unknown>)[parameter];
    if (!details || Array.isArray(details) || typeof details !== 'object') {
      return null;
    }
    const origin = (details as Record<string, unknown>).origin;
    return Object.values(PricingParameterOrigin).includes(
      origin as PricingParameterOrigin,
    )
      ? (origin as CalculatorParameterOrigin)
      : null;
  }

  private decimal(value: Prisma.Decimal | null): string | null {
    return value === null ? null : serializePricingDecimal(value);
  }

  private inputDecimal(value: string | null): string | null {
    return value === null
      ? null
      : serializePricingDecimal(new Prisma.Decimal(value));
  }

  private normalizeUnit(value: string): string {
    return value.trim().toUpperCase();
  }

  private calculatorError(error: PricingCalculatorError) {
    return new PricingHttpException(
      HttpStatus.BAD_REQUEST,
      error.code,
      error.message,
      { field: error.field },
    );
  }

  private isConcurrentModification(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
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

  private configurationRequired() {
    return new PricingHttpException(
      HttpStatus.CONFLICT,
      PricingErrorCode.PRICING_CONFIGURATION_REQUIRED,
      'Configure a precificação da organização antes de calcular.',
    );
  }
}
