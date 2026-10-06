import { HttpStatus, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  CreatePricingProfileDto,
  DeactivatePricingProfileDto,
  ListPricingProfilesQueryDto,
  PricingDeductionDto,
  UpdatePricingProfileDto,
} from '../dto/pricing-profiles.dto.js';
import {
  PricingErrorCode,
  PricingHttpException,
} from '../errors/pricing-http.exception.js';

const deductionSelect = {
  id: true,
  position: true,
  name: true,
  category: true,
  rate: true,
  origin: true,
  originDetails: true,
  createdAt: true,
} satisfies Prisma.PricingDeductionSelect;

const revisionSelect = {
  id: true,
  revision: true,
  name: true,
  effectiveFrom: true,
  createdAt: true,
  deductions: {
    orderBy: { position: 'asc' as const },
    select: deductionSelect,
  },
} satisfies Prisma.PricingSalesProfileRevisionSelect;

const profileSelect = {
  id: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  currentRevision: { select: revisionSelect },
} satisfies Prisma.PricingSalesProfileSelect;

type ProfileRecord = Prisma.PricingSalesProfileGetPayload<{
  select: typeof profileSelect;
}>;
type DeductionRecord = NonNullable<
  ProfileRecord['currentRevision']
>['deductions'][number];

interface ResolvedDeduction {
  position: number;
  name: string;
  category: string;
  rate: string;
  origin: PricingDeductionDto['origin'];
  originDetails: Prisma.InputJsonObject;
}

@Injectable()
export class PricingProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ListPricingProfilesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.PricingSalesProfileWhereInput = {
      organizationId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [profiles, total] = await this.prisma.$transaction([
      this.prisma.pricingSalesProfile.findMany({
        where,
        orderBy: [{ currentRevision: { name: 'asc' } }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: profileSelect,
      }),
      this.prisma.pricingSalesProfile.count({ where }),
    ]);
    return {
      data: profiles.map((profile) => this.toResponse(profile, false)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(organizationId: string, profileId: string) {
    const profile = await this.prisma.pricingSalesProfile.findFirst({
      where: { id: profileId, organizationId },
      select: profileSelect,
    });
    if (!profile?.currentRevision) throw this.notFound();
    return this.toResponse(profile, true);
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreatePricingProfileDto,
  ) {
    return this.mutate(async () =>
      this.prisma.$transaction(async (transaction) => {
        await this.lockOrganization(transaction, organizationId);
        const effectiveFrom = new Date();
        const deductions = this.resolveDeductions(
          dto.deductions ?? [],
          actorUserId,
        );
        const root = await transaction.pricingSalesProfile.create({
          data: {
            organizationId,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
          select: { id: true },
        });
        const revision = await transaction.pricingSalesProfileRevision.create({
          data: {
            organizationId,
            profileId: root.id,
            revision: 1,
            name: dto.name,
            effectiveFrom,
            createdByUserId: actorUserId,
          },
          select: { id: true },
        });
        if (deductions.length > 0) {
          await transaction.pricingDeduction.createMany({
            data: deductions.map((deduction) => ({
              organizationId,
              profileRevisionId: revision.id,
              ...deduction,
            })),
          });
        }
        const profile = await transaction.pricingSalesProfile.update({
          where: { id: root.id },
          data: {
            currentRevisionId: revision.id,
            updatedByUserId: actorUserId,
          },
          select: profileSelect,
        });
        await this.audit(
          transaction,
          organizationId,
          actorUserId,
          root.id,
          'pricing_sales_profile.created',
          {
            profileId: root.id,
            revision: 1,
          },
        );
        return this.toResponse(profile, true);
      }),
    );
  }

  async update(
    organizationId: string,
    actorUserId: string,
    profileId: string,
    dto: UpdatePricingProfileDto,
  ) {
    return this.mutate(async () =>
      this.prisma.$transaction(async (transaction) => {
        await this.lockProfile(transaction, organizationId, profileId);
        const current = await this.readProfile(
          transaction,
          organizationId,
          profileId,
        );
        this.assertRevision(current, dto.expectedRevision);
        if (!current.isActive) throw this.inactive();

        const name = dto.name ?? current.currentRevision!.name;
        const deductions =
          dto.deductions === undefined
            ? current.currentRevision!.deductions.map((item) =>
                this.fromRecord(item),
              )
            : this.resolveDeductions(dto.deductions, actorUserId);
        const changedFields = [
          ...(name === current.currentRevision!.name ? [] : ['name']),
          ...(this.sameDeductions(
            current.currentRevision!.deductions,
            deductions,
          )
            ? []
            : ['deductions']),
        ];
        if (changedFields.length === 0) return this.toResponse(current, true);

        const next = current.currentRevision!.revision + 1;
        const revision = await transaction.pricingSalesProfileRevision.create({
          data: {
            organizationId,
            profileId,
            revision: next,
            name,
            effectiveFrom: new Date(),
            createdByUserId: actorUserId,
          },
          select: { id: true },
        });
        if (deductions.length > 0) {
          await transaction.pricingDeduction.createMany({
            data: deductions.map((deduction) => ({
              organizationId,
              profileRevisionId: revision.id,
              ...deduction,
            })),
          });
        }
        const profile = await transaction.pricingSalesProfile.update({
          where: { id: profileId },
          data: {
            currentRevisionId: revision.id,
            updatedByUserId: actorUserId,
          },
          select: profileSelect,
        });
        await this.audit(
          transaction,
          organizationId,
          actorUserId,
          profileId,
          'pricing_sales_profile.updated',
          {
            profileId,
            previousRevision: dto.expectedRevision,
            newRevision: next,
            changedFields,
          },
        );
        return this.toResponse(profile, true);
      }),
    );
  }

  async deactivate(
    organizationId: string,
    actorUserId: string,
    profileId: string,
    dto: DeactivatePricingProfileDto,
  ) {
    return this.mutate(async () =>
      this.prisma.$transaction(async (transaction) => {
        await this.lockProfile(transaction, organizationId, profileId);
        const current = await this.readProfile(
          transaction,
          organizationId,
          profileId,
        );
        this.assertRevision(current, dto.expectedRevision);
        if (!current.isActive) return this.toResponse(current, true);
        const profile = await transaction.pricingSalesProfile.update({
          where: { id: profileId },
          data: { isActive: false, updatedByUserId: actorUserId },
          select: profileSelect,
        });
        await this.audit(
          transaction,
          organizationId,
          actorUserId,
          profileId,
          'pricing_sales_profile.deactivated',
          {
            profileId,
            currentRevision: dto.expectedRevision,
            previousState: 'ACTIVE',
          },
        );
        return this.toResponse(profile, true);
      }),
    );
  }

  private async mutate<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      if (error instanceof PricingHttpException) throw error;
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new PricingHttpException(
          HttpStatus.CONFLICT,
          PricingErrorCode.PRICING_CONCURRENT_MODIFICATION,
          'O perfil de venda foi alterado concorrentemente.',
        );
      }
      throw error;
    }
  }

  private resolveDeductions(
    items: PricingDeductionDto[],
    actorUserId: string,
  ): ResolvedDeduction[] {
    return items.map((item, index) => ({
      position: index + 1,
      name: item.name,
      category: item.category,
      rate: new Prisma.Decimal(item.rate).toString(),
      origin: item.origin,
      originDetails: {
        schemaVersion: 1,
        source: item.originDetails?.source ?? null,
        referenceId: item.originDetails?.referenceId ?? null,
        periodStart: item.originDetails?.periodStart ?? null,
        periodEnd: item.originDetails?.periodEnd ?? null,
        criterion: item.originDetails?.criterion ?? null,
        measuredAt: item.originDetails?.measuredAt ?? null,
        confirmedByUserId: actorUserId,
      },
    }));
  }

  private fromRecord(item: DeductionRecord): ResolvedDeduction {
    return {
      position: item.position,
      name: item.name,
      category: item.category,
      rate: item.rate.toString(),
      origin: item.origin,
      originDetails: item.originDetails as Prisma.InputJsonObject,
    };
  }

  private sameDeductions(
    current: DeductionRecord[],
    next: ResolvedDeduction[],
  ): boolean {
    const normalize = (value: unknown): string => {
      if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(normalize).join(',')}]`;
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${normalize(item)}`)
        .join(',')}}`;
    };
    if (current.length !== next.length) return false;
    return current.every((item, index) => {
      const candidate = next[index]!;
      return (
        item.position === candidate.position &&
        item.name === candidate.name &&
        item.category === candidate.category &&
        item.rate.equals(candidate.rate) &&
        item.origin === candidate.origin &&
        normalize(item.originDetails) === normalize(candidate.originDetails)
      );
    });
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
    if (!profile?.currentRevision) throw this.notFound();
    return profile;
  }

  private assertRevision(profile: ProfileRecord, expected: number): void {
    const current = profile.currentRevision!.revision;
    if (current !== expected)
      throw new PricingHttpException(
        HttpStatus.CONFLICT,
        PricingErrorCode.PRICING_REVISION_CONFLICT,
        'A revisão de precificação foi alterada.',
        {
          field: 'expectedRevision',
          details: { expectedRevision: expected, currentRevision: current },
        },
      );
  }

  private async lockOrganization(
    transaction: Prisma.TransactionClient,
    organizationId: string,
  ) {
    await transaction.$queryRaw`SELECT "id" FROM public."organizations" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
  }

  private async lockProfile(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    profileId: string,
  ) {
    const rows = await transaction.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM public."pricing_sales_profiles" WHERE "organization_id" = ${organizationId}::uuid AND "id" = ${profileId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw this.notFound();
  }

  private audit(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    profileId: string,
    action: string,
    metadata: Prisma.InputJsonObject,
  ) {
    return transaction.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action,
        entityType: 'pricing_sales_profile',
        entityId: profileId,
        metadata,
      },
    });
  }

  private notFound() {
    return new PricingHttpException(
      HttpStatus.NOT_FOUND,
      PricingErrorCode.PRICING_PROFILE_NOT_FOUND,
      'Perfil de venda não encontrado.',
    );
  }
  private inactive() {
    return new PricingHttpException(
      HttpStatus.CONFLICT,
      PricingErrorCode.PRICING_PROFILE_INACTIVE,
      'O perfil de venda está inativo.',
    );
  }

  private toResponse(profile: ProfileRecord, includeDeductions: boolean) {
    const revision = profile.currentRevision!;
    return {
      id: profile.id,
      isActive: profile.isActive,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      currentRevision: {
        id: revision.id,
        revision: revision.revision,
        name: revision.name,
        effectiveFrom: revision.effectiveFrom.toISOString(),
        createdAt: revision.createdAt.toISOString(),
        ...(includeDeductions
          ? {
              deductions: revision.deductions.map((item) => ({
                id: item.id,
                position: item.position,
                name: item.name,
                category: item.category,
                rate: item.rate.toString(),
                origin: item.origin,
                originDetails: item.originDetails,
                createdAt: item.createdAt.toISOString(),
              })),
            }
          : {}),
      },
    };
  }
}
