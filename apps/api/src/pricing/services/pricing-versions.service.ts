import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PricingVersionState } from '../../generated/prisma/enums.js';
import {
  materializePricingSnapshotInputV1,
  materializePricingSnapshotResultV1,
  parsePricingSnapshotV1,
  type PricingComponentProvenanceV1,
  type PricingDeductionProvenanceV1,
  type PricingParameterNameV1,
  type PricingParameterProvenanceV1,
  type PricingProvenanceDetailsV1,
  type PricingSnapshotV1,
} from '../contracts/pricing-snapshot-v1.js';
import type {
  CreatePricingVersionDto,
  ListPricingVersionsQueryDto,
} from '../dto/pricing-version.dto.js';
import {
  PricingErrorCode,
  PricingHttpException,
} from '../errors/pricing-http.exception.js';
import { serializePricingDecimal } from '../pricing-decimal-serialization.js';
import {
  PricingCalculationsService,
  type PricingPersistedCalculation,
} from './pricing-calculations.service.js';

const versionDetailSelect = {
  id: true,
  organizationId: true,
  productId: true,
  number: true,
  compositionId: true,
  compositionRevision: true,
  configurationRevisionId: true,
  profileRevisionId: true,
  state: true,
  snapshot: true,
  minimumPriceCommercial: true,
  suggestedPriceCommercial: true,
  analyzedPrice: true,
  classification: true,
  componentCount: true,
  deductionCount: true,
  formulaVersion: true,
  snapshotSchemaVersion: true,
  currency: true,
  finalizedAt: true,
  createdByUserId: true,
  createdAt: true,
  components: {
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      position: true,
      description: true,
      category: true,
      unit: true,
      quantity: true,
      effectiveUnitCost: true,
      totalExact: true,
      totalDisplay: true,
      sourceProductId: true,
      costSource: true,
      originDetails: true,
      createdAt: true,
    },
  },
  deductions: {
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      position: true,
      name: true,
      category: true,
      rate: true,
      amountExact: true,
      amountDisplay: true,
      origin: true,
      originDetails: true,
      createdAt: true,
    },
  },
} satisfies Prisma.PricingCalculationVersionSelect;

const versionDetailWithAdoptionSelect = {
  ...versionDetailSelect,
  product: {
    select: { adoptedPricingVersionId: true },
  },
} satisfies Prisma.PricingCalculationVersionSelect;

const VERSION_NUMBER_UNIQUE_INDEX =
  'pricing_calculation_versions_org_product_number_key';

type VersionDetailRecord = Prisma.PricingCalculationVersionGetPayload<{
  select: typeof versionDetailSelect;
}>;

type VersionDetailWithAdoptionRecord =
  Prisma.PricingCalculationVersionGetPayload<{
    select: typeof versionDetailWithAdoptionSelect;
  }>;

interface PreliminaryLockSet {
  readonly configurationId: string;
  readonly profileIds: readonly string[];
  readonly productIds: readonly string[];
}

class PricingLockSetChangedError extends Error {}

@Injectable()
export class PricingVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculations: PricingCalculationsService,
  ) {}

  async create(
    organizationId: string,
    actorUserId: string,
    productId: string,
    dto: CreatePricingVersionDto,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const lockSet = await this.readPreliminaryLockSet(
        organizationId,
        productId,
      );
      try {
        return await this.prisma.$transaction(
          (transaction) =>
            this.createInTransaction(
              transaction,
              organizationId,
              actorUserId,
              productId,
              dto,
              lockSet,
            ),
          { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
        );
      } catch (error) {
        if (
          (error instanceof PricingLockSetChangedError ||
            this.isConcurrentModification(error) ||
            this.isVersionNumberConflict(error)) &&
          attempt < 2
        )
          continue;
        if (
          this.isConcurrentModification(error) ||
          this.isVersionNumberConflict(error)
        )
          throw this.concurrentModification();
        throw error;
      }
    }
    throw this.concurrentModification();
  }

  async findAll(
    organizationId: string,
    productId: string,
    query: ListPricingVersionsQueryDto,
  ) {
    await this.assertProduct(organizationId, productId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.PricingCalculationVersionWhereInput = {
      organizationId,
      productId,
      state: PricingVersionState.FINALIZED,
    };
    const [versions, total] = await this.prisma.$transaction([
      this.prisma.pricingCalculationVersion.findMany({
        where,
        orderBy: [{ number: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          number: true,
          compositionRevision: true,
          minimumPriceCommercial: true,
          suggestedPriceCommercial: true,
          analyzedPrice: true,
          classification: true,
          formulaVersion: true,
          snapshotSchemaVersion: true,
          currency: true,
          finalizedAt: true,
          createdByUserId: true,
          createdAt: true,
          product: {
            select: { adoptedPricingVersionId: true },
          },
        },
      }),
      this.prisma.pricingCalculationVersion.count({ where }),
    ]);
    return {
      data: versions.map(({ product, ...version }) => ({
        ...version,
        isAdopted: product.adoptedPricingVersionId === version.id,
        finalizedAt: version.finalizedAt!.toISOString(),
        createdAt: version.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(organizationId: string, productId: string, versionId: string) {
    await this.assertProduct(organizationId, productId);
    const version = await this.prisma.pricingCalculationVersion.findFirst({
      where: { id: versionId, organizationId, productId },
      select: versionDetailWithAdoptionSelect,
    });
    if (!version) throw this.versionNotFound();
    if (version.state !== PricingVersionState.FINALIZED) {
      throw new PricingHttpException(
        HttpStatus.CONFLICT,
        PricingErrorCode.PRICING_VERSION_NOT_FINALIZED,
        'A versão de precificação ainda não foi finalizada.',
      );
    }
    return this.toDetailWithAdoption(version);
  }

  private async createInTransaction(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    productId: string,
    dto: CreatePricingVersionDto,
    lockSet: PreliminaryLockSet,
  ) {
    await this.lockConfiguration(
      transaction,
      organizationId,
      lockSet.configurationId,
    );
    await this.lockProfiles(transaction, organizationId, lockSet.profileIds);
    await this.lockProducts(transaction, organizationId, lockSet.productIds);

    const calculation = await this.calculations.resolvePersistedInTransaction(
      transaction,
      organizationId,
      productId,
      dto.adoptedPrice,
    );
    this.assertLockSet(calculation, lockSet);
    if (
      calculation.records.composition.revision !==
      dto.expectedCompositionRevision
    ) {
      throw new PricingHttpException(
        HttpStatus.CONFLICT,
        PricingErrorCode.PRICING_REVISION_CONFLICT,
        'A revisão de precificação foi alterada.',
        {
          field: 'expectedCompositionRevision',
          details: {
            expectedRevision: dto.expectedCompositionRevision,
            currentRevision: calculation.records.composition.revision,
          },
        },
      );
    }

    const calculatedAt = new Date();
    const snapshot = this.buildSnapshot(
      organizationId,
      actorUserId,
      calculatedAt,
      calculation,
    );
    parsePricingSnapshotV1(snapshot);
    const aggregate = await transaction.pricingCalculationVersion.aggregate({
      where: { organizationId, productId },
      _max: { number: true },
    });
    const number = (aggregate._max.number ?? 0) + 1;
    const id = randomUUID();
    const { response, records } = calculation;
    await transaction.pricingCalculationVersion.create({
      data: {
        id,
        organizationId,
        productId,
        number,
        compositionId: records.composition.id,
        compositionRevision: records.composition.revision,
        configurationRevisionId: response.configuration.revisionId,
        profileRevisionId: response.profile?.revisionId ?? null,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        minimumPriceCommercial: snapshot.result.minimumPrice.commercial,
        suggestedPriceCommercial: snapshot.result.suggestedPrice.commercial,
        analyzedPrice: snapshot.result.analysis.price,
        classification: snapshot.result.analysis.classification,
        componentCount: snapshot.result.components.length,
        deductionCount: snapshot.result.analysis.deductions.length,
        formulaVersion: snapshot.formulaVersion,
        snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
        currency: snapshot.input.currency,
        createdByUserId: actorUserId,
      },
      select: { id: true },
    });
    await transaction.pricingVersionComponent.createMany({
      data: snapshot.result.components.map((item, index) => ({
        organizationId,
        versionId: id,
        position: item.position,
        description: item.description,
        category: item.category,
        unit: item.unit,
        quantity: item.quantity,
        effectiveUnitCost: item.unitCost,
        totalExact: item.total.exact,
        totalDisplay: item.total.display,
        sourceProductId: item.productId,
        costSource: item.origin,
        originDetails: snapshot.context.componentOrigins[
          index
        ] as unknown as Prisma.InputJsonValue,
      })),
    });
    await transaction.pricingVersionDeduction.createMany({
      data: snapshot.result.analysis.deductions.map((item, index) => ({
        organizationId,
        versionId: id,
        position: item.position,
        name: item.name,
        category: item.category,
        rate: item.rate,
        amountExact: item.amount.exact,
        amountDisplay: item.amount.display,
        origin: item.origin,
        originDetails: snapshot.context.deductionOrigins[
          index
        ] as unknown as Prisma.InputJsonValue,
      })),
    });
    await transaction.pricingCalculationVersion.update({
      where: { id },
      data: { state: PricingVersionState.FINALIZED, finalizedAt: calculatedAt },
      select: { id: true },
    });
    await this.audit(transaction, {
      organizationId,
      actorUserId,
      productId,
      versionId: id,
      number,
      formulaVersion: snapshot.formulaVersion,
      snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
      compositionRevision: records.composition.revision,
    });
    const finalized = await transaction.pricingCalculationVersion.findFirst({
      where: {
        id,
        organizationId,
        productId,
        state: PricingVersionState.FINALIZED,
      },
      select: versionDetailSelect,
    });
    if (!finalized) throw this.versionNotFound();
    return this.toDetail(finalized);
  }

  private audit(
    transaction: Prisma.TransactionClient,
    data: {
      organizationId: string;
      actorUserId: string;
      productId: string;
      versionId: string;
      number: number;
      formulaVersion: string;
      snapshotSchemaVersion: number;
      compositionRevision: number;
    },
  ) {
    return transaction.auditLog.create({
      data: {
        organizationId: data.organizationId,
        actorUserId: data.actorUserId,
        action: 'pricing_calculation_version.created',
        entityType: 'pricing_calculation_version',
        entityId: data.versionId,
        metadata: {
          productId: data.productId,
          versionId: data.versionId,
          number: data.number,
          formulaVersion: data.formulaVersion,
          snapshotSchemaVersion: data.snapshotSchemaVersion,
          compositionRevision: data.compositionRevision,
        },
      },
    });
  }

  private buildSnapshot(
    organizationId: string,
    actorUserId: string,
    calculatedAt: Date,
    calculation: PricingPersistedCalculation,
  ): PricingSnapshotV1 {
    const { response, records } = calculation;
    const revision = records.configuration.currentRevision!;
    const input = materializePricingSnapshotInputV1(response.resolvedInput);
    const result = materializePricingSnapshotResultV1(response.result);
    const componentOrigins = records.composition.components.map(
      (item, index) => ({
        schemaVersion: 1 as const,
        position: index + 1,
        origin: input.components[index]!.origin,
        sourceProductId: input.components[index]!.productId,
        effectiveUnitCost: input.components[index]!.unitCost,
        ...this.details(item.originDetails),
      }),
    ) satisfies PricingComponentProvenanceV1[];
    const deductionOrigins =
      records.profile?.currentRevision?.deductions.map((item, index) => ({
        schemaVersion: 1 as const,
        position: index + 1,
        origin: item.origin,
        ...this.details(item.originDetails),
      })) ?? ([] satisfies PricingDeductionProvenanceV1[]);
    const fixedCosts =
      input.fixedCosts === null
        ? null
        : input.fixedCosts.mode === 'RATE'
          ? { mode: 'RATE' as const, rate: input.fixedCosts.rate }
          : {
              mode: 'MONTHLY' as const,
              monthlyCost: input.fixedCosts.monthlyCost,
              averageRevenue: input.fixedCosts.averageRevenue,
            };
    return {
      snapshotSchemaVersion: 1,
      formulaVersion: 'margin-divisor-v1',
      input,
      result,
      context: {
        organizationId,
        product: {
          id: records.target.id,
          type: records.target.type,
          name: records.target.name,
          unit: records.target.unit,
        },
        composition: {
          id: records.composition.id,
          revision: records.composition.revision,
          parameterOrigins: this.parameterOrigins(
            records.composition.parameterOrigins,
          ),
        },
        configuration: {
          id: records.configuration.id,
          revisionId: revision.id,
          revision: revision.revision,
          effectiveFrom: revision.effectiveFrom.toISOString(),
          currency: 'BRL',
          fixedCosts,
          monthlyLaborCost: this.decimal(revision.monthlyLaborCost),
          productiveHours: this.decimal(revision.productiveHours),
          defaultDesiredMargin: this.decimal(revision.defaultDesiredMargin),
          parameterOrigins: this.parameterOrigins(revision.parameterOrigins),
        },
        salesProfile: response.profile,
        effectiveDesiredMargin: {
          value: response.effectiveDesiredMargin.value,
          origin: response.effectiveDesiredMargin.origin!,
          precedence: response.effectiveDesiredMargin.precedence,
        },
        componentOrigins,
        deductionOrigins,
        calculatedAt: calculatedAt.toISOString(),
        calculatedByUserId: actorUserId,
        decimalPolicy: {
          library: 'decimal.js',
          precision: 160,
          commercialRounding: 'ROUND_CEIL',
          informationalRounding: 'ROUND_HALF_UP',
        },
      },
    };
  }

  private parameterOrigins(value: unknown): PricingParameterProvenanceV1[] {
    if (value === null || Array.isArray(value) || typeof value !== 'object')
      return [];
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([parameter, raw]) => {
        if (raw === null || Array.isArray(raw) || typeof raw !== 'object') {
          throw new Error('Invalid persisted pricing parameter provenance');
        }
        const item = raw as Record<string, unknown>;
        return {
          schemaVersion: 1,
          parameter: parameter as PricingParameterNameV1,
          origin: item.origin as PricingParameterProvenanceV1['origin'],
          ...this.details(item),
        };
      });
  }

  private details(value: unknown): PricingProvenanceDetailsV1 {
    const item =
      value !== null && !Array.isArray(value) && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {};
    return {
      source: this.nullableText(item.source),
      referenceId: this.nullableText(item.referenceId),
      periodStart: this.nullableTimestamp(item.periodStart),
      periodEnd: this.nullableTimestamp(item.periodEnd),
      criterion: this.nullableText(item.criterion),
      measuredAt: this.nullableTimestamp(item.measuredAt),
      confirmedByUserId: this.nullableText(item.confirmedByUserId),
    };
  }

  private nullableText(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private nullableTimestamp(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    return new Date(value).toISOString();
  }

  private decimal(value: Prisma.Decimal | null): string | null {
    return value === null ? null : serializePricingDecimal(value);
  }

  private toDetail(version: VersionDetailRecord) {
    const snapshot = parsePricingSnapshotV1(version.snapshot);
    if (
      snapshot.context.organizationId !== version.organizationId ||
      snapshot.context.product.id !== version.productId ||
      snapshot.context.composition.id !== version.compositionId ||
      snapshot.context.composition.revision !== version.compositionRevision ||
      snapshot.context.configuration.revisionId !==
        version.configurationRevisionId ||
      (snapshot.context.salesProfile?.revisionId ?? null) !==
        version.profileRevisionId ||
      snapshot.formulaVersion !== version.formulaVersion ||
      snapshot.snapshotSchemaVersion !== version.snapshotSchemaVersion
    ) {
      throw new Error(
        'Pricing snapshot references differ from version columns',
      );
    }
    return {
      ...version,
      snapshot,
      finalizedAt: version.finalizedAt!.toISOString(),
      createdAt: version.createdAt.toISOString(),
      components: version.components.map((item) => ({
        ...item,
        quantity: serializePricingDecimal(item.quantity),
        effectiveUnitCost: serializePricingDecimal(item.effectiveUnitCost),
        createdAt: item.createdAt.toISOString(),
      })),
      deductions: version.deductions.map((item) => ({
        ...item,
        rate: serializePricingDecimal(item.rate),
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  private toDetailWithAdoption(version: VersionDetailWithAdoptionRecord) {
    const { product, ...detail } = version;
    return {
      ...this.toDetail(detail),
      isAdopted: product.adoptedPricingVersionId === version.id,
    };
  }

  private async readPreliminaryLockSet(
    organizationId: string,
    productId: string,
  ): Promise<PreliminaryLockSet> {
    const [configuration, composition, product] = await Promise.all([
      this.prisma.organizationPricingConfiguration.findUnique({
        where: { organizationId },
        select: { id: true, isActive: true, currentRevisionId: true },
      }),
      this.prisma.productPricingComposition.findFirst({
        where: { organizationId, productId, isActive: true },
        select: {
          profileId: true,
          components: {
            where: { costSource: 'CATALOG' },
            select: { sourceProductId: true },
          },
        },
      }),
      this.prisma.product.findFirst({
        where: { organizationId, id: productId },
        select: { id: true },
      }),
    ]);
    if (!product) throw this.productNotFound();
    if (!configuration?.isActive || !configuration.currentRevisionId) {
      throw this.configurationRequired();
    }
    if (!composition) throw this.compositionNotFound();
    return {
      configurationId: configuration.id,
      profileIds: composition.profileId ? [composition.profileId] : [],
      productIds: [
        productId,
        ...composition.components
          .map((item) => item.sourceProductId)
          .filter((id): id is string => id !== null),
      ]
        .filter((id, index, values) => values.indexOf(id) === index)
        .sort(),
    };
  }

  private assertLockSet(
    calculation: PricingPersistedCalculation,
    expected: PreliminaryLockSet,
  ): void {
    const actualProfiles = calculation.records.composition.profileId
      ? [calculation.records.composition.profileId]
      : [];
    const actualProducts = [
      calculation.records.target.id,
      ...calculation.records.composition.components
        .filter((item) => item.costSource === 'CATALOG')
        .map((item) => item.sourceProductId)
        .filter((id): id is string => id !== null),
    ]
      .filter((id, index, values) => values.indexOf(id) === index)
      .sort();
    if (
      calculation.records.configuration.id !== expected.configurationId ||
      JSON.stringify(actualProfiles) !== JSON.stringify(expected.profileIds) ||
      JSON.stringify(actualProducts) !== JSON.stringify(expected.productIds)
    ) {
      throw new PricingLockSetChangedError();
    }
  }

  private async lockConfiguration(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    configurationId: string,
  ) {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM public."organization_pricing_configurations"
      WHERE "organization_id" = ${organizationId}::uuid
        AND "id" = ${configurationId}::uuid
      FOR UPDATE
    `;
    if (rows.length === 0) throw new PricingLockSetChangedError();
  }

  private async lockProfiles(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    ids: readonly string[],
  ) {
    for (const id of ids) {
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM public."pricing_sales_profiles"
        WHERE "organization_id" = ${organizationId}::uuid AND "id" = ${id}::uuid
        FOR UPDATE
      `;
      if (rows.length === 0) throw new PricingLockSetChangedError();
    }
  }

  private async lockProducts(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    ids: readonly string[],
  ) {
    for (const id of ids) {
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM public."products"
        WHERE "organization_id" = ${organizationId}::uuid AND "id" = ${id}::uuid
        FOR UPDATE
      `;
      if (rows.length === 0) throw this.productNotFound();
    }
  }

  private async assertProduct(organizationId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { organizationId, id: productId },
      select: { id: true },
    });
    if (!product) throw this.productNotFound();
  }

  private isConcurrentModification(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    );
  }

  private isVersionNumberConflict(error: unknown): boolean {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'P2002' ||
      !('meta' in error) ||
      typeof error.meta !== 'object' ||
      error.meta === null ||
      !('modelName' in error.meta) ||
      error.meta.modelName !== 'PricingCalculationVersion' ||
      !('driverAdapterError' in error.meta) ||
      typeof error.meta.driverAdapterError !== 'object' ||
      error.meta.driverAdapterError === null ||
      !('cause' in error.meta.driverAdapterError) ||
      typeof error.meta.driverAdapterError.cause !== 'object' ||
      error.meta.driverAdapterError.cause === null ||
      !('constraint' in error.meta.driverAdapterError.cause) ||
      typeof error.meta.driverAdapterError.cause.constraint !== 'object' ||
      error.meta.driverAdapterError.cause.constraint === null ||
      !('index' in error.meta.driverAdapterError.cause.constraint)
    ) {
      return false;
    }
    return (
      error.meta.driverAdapterError.cause.constraint.index ===
      VERSION_NUMBER_UNIQUE_INDEX
    );
  }

  private concurrentModification() {
    return new PricingHttpException(
      HttpStatus.CONFLICT,
      PricingErrorCode.PRICING_CONCURRENT_MODIFICATION,
      'Os dados de precificação foram alterados concorrentemente.',
    );
  }

  private productNotFound() {
    return new PricingHttpException(
      HttpStatus.NOT_FOUND,
      PricingErrorCode.PRODUCT_NOT_FOUND,
      'Produto não encontrado.',
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

  private versionNotFound() {
    return new PricingHttpException(
      HttpStatus.NOT_FOUND,
      PricingErrorCode.PRICING_VERSION_NOT_FOUND,
      'Versão de precificação não encontrada.',
    );
  }
}
