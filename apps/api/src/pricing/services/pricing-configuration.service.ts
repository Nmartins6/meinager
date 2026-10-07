import { HttpStatus, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  PricingFixedCostMode,
  type PricingFixedCostMode as PricingFixedCostModeValue,
} from '../../generated/prisma/enums.js';
import type { PricingConfigurationParameterOriginsDto } from '../dto/pricing-parameter-origin.dto.js';
import type { UpdatePricingConfigurationDto } from '../dto/update-pricing-configuration.dto.js';
import {
  PricingErrorCode,
  PricingHttpException,
} from '../errors/pricing-http.exception.js';
import { serializePricingDecimal } from '../pricing-decimal-serialization.js';

const pricingConfigurationRevisionSelect = {
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
  createdAt: true,
} satisfies Prisma.OrganizationPricingConfigurationRevisionSelect;

const pricingConfigurationSelect = {
  id: true,
  isActive: true,
  currentRevision: {
    select: pricingConfigurationRevisionSelect,
  },
} satisfies Prisma.OrganizationPricingConfigurationSelect;

type ConfigurationRecord = Prisma.OrganizationPricingConfigurationGetPayload<{
  select: typeof pricingConfigurationSelect;
}>;

type RevisionRecord = NonNullable<ConfigurationRecord['currentRevision']>;

interface ConfigurationState {
  currency: string;
  fixedCostMode: PricingFixedCostModeValue | null;
  fixedCostRate: string | null;
  monthlyFixedCost: string | null;
  averageMonthlyRevenue: string | null;
  monthlyLaborCost: string | null;
  productiveHours: string | null;
  defaultDesiredMargin: string | null;
  parameterOrigins: ConfigurationOrigins;
}

const CONFIGURATION_PARAMETERS = [
  'fixedCostMode',
  'fixedCostRate',
  'monthlyFixedCost',
  'averageMonthlyRevenue',
  'monthlyLaborCost',
  'productiveHours',
  'defaultDesiredMargin',
] as const;

type ConfigurationParameter = (typeof CONFIGURATION_PARAMETERS)[number];
type ConfigurationOrigins = Partial<
  Record<ConfigurationParameter, Prisma.InputJsonObject>
>;

const EDITABLE_FIELDS = [
  'currency',
  'fixedCostMode',
  'fixedCostRate',
  'monthlyFixedCost',
  'averageMonthlyRevenue',
  'monthlyLaborCost',
  'productiveHours',
  'defaultDesiredMargin',
  'parameterOrigins',
] as const;

@Injectable()
export class PricingConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrent(organizationId: string) {
    const configuration =
      await this.prisma.organizationPricingConfiguration.findUnique({
        where: { organizationId },
        select: pricingConfigurationSelect,
      });

    if (!configuration?.currentRevision) {
      throw this.configurationNotFound();
    }

    return this.toResponse(configuration);
  }

  async update(
    organizationId: string,
    actorUserId: string,
    dto: UpdatePricingConfigurationDto,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (dto.expectedRevision === null) {
          return this.createInitial(
            transaction,
            organizationId,
            actorUserId,
            dto,
          );
        }

        return this.createRevision(
          transaction,
          organizationId,
          actorUserId,
          dto,
        );
      });
    } catch (error) {
      if (error instanceof PricingHttpException) {
        throw error;
      }

      if (this.isConcurrentModification(error)) {
        throw new PricingHttpException(
          HttpStatus.CONFLICT,
          PricingErrorCode.PRICING_CONCURRENT_MODIFICATION,
          'A configuração de precificação foi alterada concorrentemente.',
        );
      }

      throw error;
    }
  }

  private async createInitial(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    dto: UpdatePricingConfigurationDto,
  ) {
    await this.lockOrganization(transaction, organizationId);

    const existing =
      await transaction.organizationPricingConfiguration.findUnique({
        where: { organizationId },
        select: pricingConfigurationSelect,
      });

    if (existing?.currentRevision) {
      throw this.revisionConflict(null, existing.currentRevision.revision);
    }

    if (existing) {
      throw new PricingHttpException(
        HttpStatus.CONFLICT,
        PricingErrorCode.PRICING_CONCURRENT_MODIFICATION,
        'A configuração de precificação está em construção.',
      );
    }

    const state = this.buildState(null, dto, actorUserId);
    const effectiveFrom = new Date();
    const root = await transaction.organizationPricingConfiguration.create({
      data: {
        organizationId,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
      select: { id: true },
    });

    const revision =
      await transaction.organizationPricingConfigurationRevision.create({
        data: {
          organizationId,
          configurationId: root.id,
          revision: 1,
          effectiveFrom,
          ...this.toRevisionData(state),
          createdByUserId: actorUserId,
        },
        select: { id: true },
      });

    const configuration =
      await transaction.organizationPricingConfiguration.update({
        where: { organizationId },
        data: {
          currentRevisionId: revision.id,
          updatedByUserId: actorUserId,
        },
        select: pricingConfigurationSelect,
      });

    await this.createAuditLog(transaction, {
      organizationId,
      actorUserId,
      configurationId: root.id,
      operation: 'CREATE',
      previousRevision: null,
      newRevision: 1,
      changedFields: this.initialChangedFields(state),
    });

    return this.toResponseWithRevision(configuration);
  }

  private async createRevision(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    dto: UpdatePricingConfigurationDto,
  ) {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM public."organization_pricing_configurations"
      WHERE "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw this.revisionConflict(dto.expectedRevision, null);
    }

    const current =
      await transaction.organizationPricingConfiguration.findUnique({
        where: { organizationId },
        select: pricingConfigurationSelect,
      });

    if (!current?.currentRevision) {
      throw new PricingHttpException(
        HttpStatus.CONFLICT,
        PricingErrorCode.PRICING_CONCURRENT_MODIFICATION,
        'A configuração de precificação está em construção.',
      );
    }

    if (current.currentRevision.revision !== dto.expectedRevision) {
      throw this.revisionConflict(
        dto.expectedRevision,
        current.currentRevision.revision,
      );
    }

    const state = this.buildState(current.currentRevision, dto, actorUserId);
    const changedFields = this.changedFields(current.currentRevision, state);
    if (changedFields.length === 0) {
      return this.toResponseWithRevision(current);
    }

    const newRevisionNumber = current.currentRevision.revision + 1;
    const revision =
      await transaction.organizationPricingConfigurationRevision.create({
        data: {
          organizationId,
          configurationId: current.id,
          revision: newRevisionNumber,
          effectiveFrom: new Date(),
          ...this.toRevisionData(state),
          createdByUserId: actorUserId,
        },
        select: { id: true },
      });

    const configuration =
      await transaction.organizationPricingConfiguration.update({
        where: { organizationId },
        data: {
          currentRevisionId: revision.id,
          updatedByUserId: actorUserId,
        },
        select: pricingConfigurationSelect,
      });

    await this.createAuditLog(transaction, {
      organizationId,
      actorUserId,
      configurationId: current.id,
      operation: 'UPDATE',
      previousRevision: current.currentRevision.revision,
      newRevision: newRevisionNumber,
      changedFields,
    });

    return this.toResponseWithRevision(configuration);
  }

  private buildState(
    current: RevisionRecord | null,
    dto: UpdatePricingConfigurationDto,
    actorUserId: string,
  ): ConfigurationState {
    const currentState = this.readState(current);
    const state: ConfigurationState = {
      currency: dto.currency ?? currentState.currency,
      fixedCostMode:
        dto.fixedCostMode !== undefined
          ? dto.fixedCostMode
          : currentState.fixedCostMode,
      fixedCostRate:
        dto.fixedCostRate !== undefined
          ? this.canonicalDecimal(dto.fixedCostRate)
          : currentState.fixedCostRate,
      monthlyFixedCost:
        dto.monthlyFixedCost !== undefined
          ? this.canonicalDecimal(dto.monthlyFixedCost)
          : currentState.monthlyFixedCost,
      averageMonthlyRevenue:
        dto.averageMonthlyRevenue !== undefined
          ? this.canonicalDecimal(dto.averageMonthlyRevenue)
          : currentState.averageMonthlyRevenue,
      monthlyLaborCost:
        dto.monthlyLaborCost !== undefined
          ? this.canonicalDecimal(dto.monthlyLaborCost)
          : currentState.monthlyLaborCost,
      productiveHours:
        dto.productiveHours !== undefined
          ? this.canonicalDecimal(dto.productiveHours)
          : currentState.productiveHours,
      defaultDesiredMargin:
        dto.defaultDesiredMargin !== undefined
          ? this.canonicalDecimal(dto.defaultDesiredMargin)
          : currentState.defaultDesiredMargin,
      parameterOrigins: {},
    };

    this.normalizeAndValidateFixedCosts(state, dto);
    this.validateLabor(state);
    state.parameterOrigins = this.resolveOrigins(
      currentState,
      state,
      dto.parameterOrigins,
      actorUserId,
    );
    return state;
  }

  private readState(current: RevisionRecord | null): ConfigurationState {
    return {
      currency: current?.currency ?? 'BRL',
      fixedCostMode: current?.fixedCostMode ?? null,
      fixedCostRate: current?.fixedCostRate
        ? serializePricingDecimal(current.fixedCostRate)
        : null,
      monthlyFixedCost: current?.monthlyFixedCost
        ? serializePricingDecimal(current.monthlyFixedCost)
        : null,
      averageMonthlyRevenue: current?.averageMonthlyRevenue
        ? serializePricingDecimal(current.averageMonthlyRevenue)
        : null,
      monthlyLaborCost: current?.monthlyLaborCost
        ? serializePricingDecimal(current.monthlyLaborCost)
        : null,
      productiveHours: current?.productiveHours
        ? serializePricingDecimal(current.productiveHours)
        : null,
      defaultDesiredMargin: current?.defaultDesiredMargin
        ? serializePricingDecimal(current.defaultDesiredMargin)
        : null,
      parameterOrigins: this.readOrigins(current?.parameterOrigins),
    };
  }

  private canonicalDecimal(value: string | null): string | null {
    return value === null
      ? null
      : serializePricingDecimal(new Prisma.Decimal(value));
  }

  private normalizeAndValidateFixedCosts(
    state: ConfigurationState,
    dto: UpdatePricingConfigurationDto,
  ): void {
    const invalid = (field: string): never => {
      throw new PricingHttpException(
        HttpStatus.BAD_REQUEST,
        PricingErrorCode.VALIDATION_ERROR,
        'Os campos de custo fixo não correspondem ao modo informado.',
        { field },
      );
    };

    if (state.fixedCostMode === null) {
      if (dto.fixedCostRate !== undefined && dto.fixedCostRate !== null) {
        invalid('fixedCostRate');
      }
      if (dto.monthlyFixedCost !== undefined && dto.monthlyFixedCost !== null) {
        invalid('monthlyFixedCost');
      }
      if (
        dto.averageMonthlyRevenue !== undefined &&
        dto.averageMonthlyRevenue !== null
      ) {
        invalid('averageMonthlyRevenue');
      }

      state.fixedCostRate = null;
      state.monthlyFixedCost = null;
      state.averageMonthlyRevenue = null;
      return;
    }

    if (state.fixedCostMode === PricingFixedCostMode.RATE) {
      if (dto.monthlyFixedCost != null) invalid('monthlyFixedCost');
      if (dto.averageMonthlyRevenue != null) invalid('averageMonthlyRevenue');
      if (state.fixedCostRate === null) invalid('fixedCostRate');

      state.monthlyFixedCost = null;
      state.averageMonthlyRevenue = null;
      return;
    }

    if (dto.fixedCostRate != null) invalid('fixedCostRate');
    if (state.monthlyFixedCost === null) invalid('monthlyFixedCost');
    const averageMonthlyRevenue = state.averageMonthlyRevenue;
    if (averageMonthlyRevenue === null) invalid('averageMonthlyRevenue');
    if (new Prisma.Decimal(averageMonthlyRevenue!).isZero()) {
      throw new PricingHttpException(
        HttpStatus.BAD_REQUEST,
        PricingErrorCode.INVALID_AVERAGE_REVENUE,
        'O faturamento médio mensal deve ser maior que zero.',
        { field: 'averageMonthlyRevenue' },
      );
    }

    state.fixedCostRate = null;
  }

  private validateLabor(state: ConfigurationState): void {
    const hasCost = state.monthlyLaborCost !== null;
    const hasHours = state.productiveHours !== null;
    if (hasCost !== hasHours) {
      throw new PricingHttpException(
        HttpStatus.BAD_REQUEST,
        PricingErrorCode.VALIDATION_ERROR,
        'Custo mensal de mão de obra e horas produtivas devem ser informados juntos.',
        { field: hasCost ? 'productiveHours' : 'monthlyLaborCost' },
      );
    }

    if (
      state.productiveHours !== null &&
      new Prisma.Decimal(state.productiveHours).isZero()
    ) {
      throw new PricingHttpException(
        HttpStatus.BAD_REQUEST,
        PricingErrorCode.INVALID_PRODUCTIVE_HOURS,
        'As horas produtivas devem ser maiores que zero.',
        { field: 'productiveHours' },
      );
    }
  }

  private toRevisionData(state: ConfigurationState) {
    return {
      currency: state.currency,
      fixedCostMode: state.fixedCostMode,
      fixedCostRate: state.fixedCostRate,
      monthlyFixedCost: state.monthlyFixedCost,
      averageMonthlyRevenue: state.averageMonthlyRevenue,
      monthlyLaborCost: state.monthlyLaborCost,
      productiveHours: state.productiveHours,
      defaultDesiredMargin: state.defaultDesiredMargin,
      parameterOrigins: state.parameterOrigins as Prisma.InputJsonObject,
    };
  }

  private resolveOrigins(
    current: ConfigurationState,
    resolved: ConfigurationState,
    patch: PricingConfigurationParameterOriginsDto | undefined,
    actorUserId: string,
  ): ConfigurationOrigins {
    const result: ConfigurationOrigins = {};

    for (const parameter of CONFIGURATION_PARAMETERS) {
      const active = resolved[parameter] !== null;
      const provenance = patch?.[parameter];
      const supplied = provenance !== undefined;

      if (!active) {
        if (supplied) {
          throw this.invalidOrigin(
            parameter,
            'Não informe proveniência para um parâmetro ausente ou incompatível.',
          );
        }
        continue;
      }

      if (supplied) {
        if (!provenance) {
          throw this.invalidOrigin(
            parameter,
            'A proveniência informada para o parâmetro é inválida.',
          );
        }

        result[parameter] = this.canonicalJsonObject({
          schemaVersion: 1,
          origin: provenance.origin,
          source: provenance.source ?? null,
          referenceId: provenance.referenceId ?? null,
          periodStart: provenance.periodStart ?? null,
          periodEnd: provenance.periodEnd ?? null,
          criterion: provenance.criterion ?? null,
          measuredAt: provenance.measuredAt ?? null,
          confirmedByUserId: actorUserId,
        });
        continue;
      }

      const valueChanged = !this.valuesEqual(
        current[parameter],
        resolved[parameter],
      );
      if (valueChanged) {
        throw this.invalidOrigin(
          parameter,
          'Informe a proveniência do parâmetro criado ou alterado.',
        );
      }

      const previous = current.parameterOrigins[parameter];
      if (previous) {
        result[parameter] = this.canonicalJsonObject(previous);
      }
    }

    return result;
  }

  private readOrigins(
    value: Prisma.JsonValue | undefined,
  ): ConfigurationOrigins {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {};
    }

    const result: ConfigurationOrigins = {};
    for (const parameter of CONFIGURATION_PARAMETERS) {
      const provenance = value[parameter];
      if (
        provenance &&
        !Array.isArray(provenance) &&
        typeof provenance === 'object'
      ) {
        result[parameter] = this.canonicalJsonObject(
          provenance as Prisma.InputJsonObject,
        );
      }
    }
    return result;
  }

  private invalidOrigin(
    parameter: ConfigurationParameter,
    message: string,
  ): PricingHttpException {
    return new PricingHttpException(
      HttpStatus.BAD_REQUEST,
      PricingErrorCode.VALIDATION_ERROR,
      message,
      { field: `parameterOrigins.${parameter}` },
    );
  }

  private async lockOrganization(
    transaction: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<void> {
    const organizations = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM public."organizations"
      WHERE "id" = ${organizationId}::uuid
      FOR UPDATE
    `;

    if (organizations.length === 0) {
      throw this.configurationNotFound();
    }
  }

  private async createAuditLog(
    transaction: Prisma.TransactionClient,
    data: {
      organizationId: string;
      actorUserId: string;
      configurationId: string;
      operation: 'CREATE' | 'UPDATE';
      previousRevision: number | null;
      newRevision: number;
      changedFields: string[];
    },
  ): Promise<void> {
    await transaction.auditLog.create({
      data: {
        organizationId: data.organizationId,
        actorUserId: data.actorUserId,
        action: 'pricing_configuration.updated',
        entityType: 'organization_pricing_configuration',
        entityId: data.configurationId,
        metadata: {
          operation: data.operation,
          configurationId: data.configurationId,
          previousRevision: data.previousRevision,
          newRevision: data.newRevision,
          changedFields: data.changedFields,
        },
      },
    });
  }

  private changedFields(
    current: RevisionRecord,
    state: ConfigurationState,
  ): string[] {
    const currentState = this.readState(current);

    return EDITABLE_FIELDS.filter(
      (field) => !this.valuesEqual(currentState[field], state[field]),
    );
  }

  private initialChangedFields(state: ConfigurationState): string[] {
    return EDITABLE_FIELDS.filter((field) => {
      if (field === 'currency') return true;
      if (field === 'parameterOrigins') {
        return Object.keys(state.parameterOrigins).length > 0;
      }
      return state[field] !== null;
    });
  }

  private valuesEqual(left: unknown, right: unknown): boolean {
    return this.stableJson(left) === this.stableJson(right);
  }

  private canonicalJsonObject(
    value: Prisma.InputJsonObject,
  ): Prisma.InputJsonObject {
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

    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${this.stableJson(item)}`);
    return `{${entries.join(',')}}`;
  }

  private revisionConflict(
    expectedRevision: number | null,
    currentRevision: number | null,
  ): PricingHttpException {
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

  private configurationNotFound(): PricingHttpException {
    return new PricingHttpException(
      HttpStatus.NOT_FOUND,
      PricingErrorCode.PRICING_CONFIGURATION_NOT_FOUND,
      'Configuração de precificação não encontrada.',
    );
  }

  private isConcurrentModification(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return error.code === 'P2002' || error.code === 'P2034';
  }

  private toResponse(configuration: ConfigurationRecord) {
    return this.toResponseWithRevision(configuration);
  }

  private toResponseWithRevision(configuration: ConfigurationRecord) {
    const revision = configuration.currentRevision;
    if (!revision) {
      throw this.configurationNotFound();
    }

    return {
      id: configuration.id,
      isActive: configuration.isActive,
      currentRevision: {
        id: revision.id,
        revision: revision.revision,
        effectiveFrom: revision.effectiveFrom.toISOString(),
        currency: revision.currency,
        fixedCostMode: revision.fixedCostMode,
        fixedCostRate: revision.fixedCostRate
          ? serializePricingDecimal(revision.fixedCostRate)
          : null,
        monthlyFixedCost: revision.monthlyFixedCost
          ? serializePricingDecimal(revision.monthlyFixedCost)
          : null,
        averageMonthlyRevenue:
          revision.averageMonthlyRevenue !== null
            ? serializePricingDecimal(revision.averageMonthlyRevenue)
            : null,
        monthlyLaborCost: revision.monthlyLaborCost
          ? serializePricingDecimal(revision.monthlyLaborCost)
          : null,
        productiveHours: revision.productiveHours
          ? serializePricingDecimal(revision.productiveHours)
          : null,
        defaultDesiredMargin: revision.defaultDesiredMargin
          ? serializePricingDecimal(revision.defaultDesiredMargin)
          : null,
        parameterOrigins: revision.parameterOrigins,
        createdAt: revision.createdAt.toISOString(),
      },
    };
  }
}
