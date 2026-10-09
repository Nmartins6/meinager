import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { HttpStatus, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  OrganizationRole,
  PricingClassification,
  PricingVersionState,
} from '../../generated/prisma/enums.js';
import {
  parsePricingSnapshotV1,
  type PricingSnapshotV1,
} from '../contracts/pricing-snapshot-v1.js';
import type { CreatePricingAdoptionDto } from '../dto/pricing-adoption.dto.js';
import {
  PricingErrorCode,
  PricingHttpException,
} from '../errors/pricing-http.exception.js';
import { serializePricingDecimal } from '../pricing-decimal-serialization.js';

const adoptionVersionSelect = {
  id: true,
  organizationId: true,
  productId: true,
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
  components: {
    orderBy: { position: 'asc' as const },
    select: {
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
    },
  },
  deductions: {
    orderBy: { position: 'asc' as const },
    select: {
      position: true,
      name: true,
      category: true,
      rate: true,
      amountExact: true,
      amountDisplay: true,
      origin: true,
      originDetails: true,
    },
  },
} satisfies Prisma.PricingCalculationVersionSelect;

const adoptionSelect = {
  id: true,
  productId: true,
  versionId: true,
  previousVersionId: true,
  previousPrice: true,
  newPrice: true,
  classification: true,
  belowMinimumConfirmed: true,
  justification: true,
  createdByUserId: true,
  createdAt: true,
} satisfies Prisma.PricingPriceAdoptionSelect;

type AdoptionVersion = Prisma.PricingCalculationVersionGetPayload<{
  select: typeof adoptionVersionSelect;
}>;
type AdoptionRecord = Prisma.PricingPriceAdoptionGetPayload<{
  select: typeof adoptionSelect;
}>;

const ADOPTION_ROLES = new Set<OrganizationRole>([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.OPERATIONS,
]);
const BELOW_MINIMUM_ROLES = new Set<OrganizationRole>([
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
]);
const COMMERCIAL_PRICE = /^(?:0|[1-9]\d{0,11})\.\d{2}$/;

@Injectable()
export class PricingAdoptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async adopt(
    organizationId: string,
    actorUserId: string,
    role: OrganizationRole,
    productId: string,
    dto: CreatePricingAdoptionDto,
  ) {
    if (!ADOPTION_ROLES.has(role)) throw this.forbidden();
    try {
      return await this.prisma.$transaction((transaction) =>
        this.adoptInTransaction(
          transaction,
          organizationId,
          actorUserId,
          role,
          productId,
          dto,
        ),
      );
    } catch (error) {
      if (this.isConcurrentModification(error)) {
        throw new PricingHttpException(
          HttpStatus.CONFLICT,
          PricingErrorCode.PRICING_CONCURRENT_MODIFICATION,
          'A precificação foi alterada por outra operação.',
        );
      }
      throw error;
    }
  }

  private async adoptInTransaction(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    role: OrganizationRole,
    productId: string,
    dto: CreatePricingAdoptionDto,
  ) {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM public."products"
      WHERE "organization_id" = ${organizationId}::uuid
        AND "id" = ${productId}::uuid
      FOR UPDATE
    `;
    if (locked.length === 0) throw this.productNotFound();

    const product = await transaction.product.findFirst({
      where: { organizationId, id: productId },
      select: { id: true, salePrice: true, adoptedPricingVersionId: true },
    });
    if (!product) throw this.productNotFound();

    const version = await transaction.pricingCalculationVersion.findFirst({
      where: { id: dto.versionId, organizationId, productId },
      select: adoptionVersionSelect,
    });
    if (!version) throw this.versionNotFound();
    if (version.state !== PricingVersionState.FINALIZED) {
      throw new PricingHttpException(
        HttpStatus.CONFLICT,
        PricingErrorCode.PRICING_VERSION_NOT_FINALIZED,
        'A versão de precificação ainda não foi finalizada.',
      );
    }

    this.assertVersionIntegrity(version);
    this.assertCommercialPrice(version.analyzedPrice);
    this.assertBelowMinimumAuthorization(role, version.classification);
    const newPrice = new Prisma.Decimal(version.analyzedPrice);

    if (
      product.adoptedPricingVersionId === version.id &&
      product.salePrice?.equals(newPrice)
    ) {
      const existing = await transaction.pricingPriceAdoption.findFirst({
        where: {
          organizationId,
          productId,
          versionId: version.id,
          newPrice,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: adoptionSelect,
      });
      if (!existing) {
        throw new Error('Adopted pricing state has no corresponding event');
      }
      return this.response(
        productId,
        version.currency,
        newPrice,
        version.id,
        existing,
      );
    }

    this.assertBelowMinimumEvidence(version.classification, dto);

    const adoptionId = randomUUID();
    const previousPrice = product.salePrice;
    const previousVersionId = product.adoptedPricingVersionId;
    await transaction.product.update({
      where: { id: productId },
      data: { salePrice: newPrice, adoptedPricingVersionId: version.id },
      select: { id: true },
    });
    const adoption = await transaction.pricingPriceAdoption.create({
      data: {
        id: adoptionId,
        organizationId,
        productId,
        versionId: version.id,
        previousVersionId,
        previousPrice,
        newPrice,
        classification: version.classification,
        belowMinimumConfirmed:
          version.classification === PricingClassification.BELOW_MINIMUM,
        justification:
          version.classification === PricingClassification.BELOW_MINIMUM
            ? dto.justification!.trim()
            : null,
        createdByUserId: actorUserId,
      },
      select: adoptionSelect,
    });
    await this.audit(transaction, {
      adoptionId,
      organizationId,
      actorUserId,
      productId,
      versionId: version.id,
      previousVersionId,
      classification: version.classification,
      belowMinimumConfirmed: adoption.belowMinimumConfirmed,
      previousPrice,
      newPrice,
    });

    return this.response(
      productId,
      version.currency,
      newPrice,
      version.id,
      adoption,
    );
  }

  private assertVersionIntegrity(version: AdoptionVersion): PricingSnapshotV1 {
    const snapshot = parsePricingSnapshotV1(version.snapshot);
    const expectedComponents = snapshot.result.components;
    const expectedDeductions = snapshot.result.analysis.deductions;
    const referencesMatch =
      snapshot.context.organizationId === version.organizationId &&
      snapshot.context.product.id === version.productId &&
      snapshot.context.composition.id === version.compositionId &&
      snapshot.context.composition.revision === version.compositionRevision &&
      snapshot.context.configuration.revisionId ===
        version.configurationRevisionId &&
      (snapshot.context.salesProfile?.revisionId ?? null) ===
        version.profileRevisionId &&
      snapshot.formulaVersion === version.formulaVersion &&
      snapshot.snapshotSchemaVersion === version.snapshotSchemaVersion;
    const summariesMatch =
      snapshot.input.currency === version.currency &&
      snapshot.result.minimumPrice.commercial ===
        version.minimumPriceCommercial &&
      snapshot.result.suggestedPrice.commercial ===
        version.suggestedPriceCommercial &&
      snapshot.result.analysis.price === version.analyzedPrice &&
      snapshot.result.analysis.classification === version.classification &&
      expectedComponents.length === version.componentCount &&
      expectedDeductions.length === version.deductionCount;
    const componentsMatch = version.components.every((item, index) => {
      const expected = expectedComponents[index];
      return (
        expected !== undefined &&
        item.position === expected.position &&
        item.description === expected.description &&
        item.category === expected.category &&
        item.unit === expected.unit &&
        item.quantity.equals(expected.quantity) &&
        item.effectiveUnitCost.equals(expected.unitCost) &&
        item.totalExact === expected.total.exact &&
        item.totalDisplay === expected.total.display &&
        item.sourceProductId === expected.productId &&
        item.costSource === expected.origin &&
        isDeepStrictEqual(
          item.originDetails,
          snapshot.context.componentOrigins[index],
        )
      );
    });
    const deductionsMatch = version.deductions.every((item, index) => {
      const expected = expectedDeductions[index];
      return (
        expected !== undefined &&
        item.position === expected.position &&
        item.name === expected.name &&
        item.category === expected.category &&
        item.rate.equals(expected.rate) &&
        item.amountExact === expected.amount.exact &&
        item.amountDisplay === expected.amount.display &&
        item.origin === expected.origin &&
        isDeepStrictEqual(
          item.originDetails,
          snapshot.context.deductionOrigins[index],
        )
      );
    });
    if (
      !referencesMatch ||
      !summariesMatch ||
      version.components.length !== expectedComponents.length ||
      version.deductions.length !== expectedDeductions.length ||
      !componentsMatch ||
      !deductionsMatch
    ) {
      throw new Error('Pricing version differs from its frozen snapshot');
    }
    return snapshot;
  }

  private assertCommercialPrice(value: string): void {
    if (!COMMERCIAL_PRICE.test(value)) {
      throw new PricingHttpException(
        HttpStatus.BAD_REQUEST,
        PricingErrorCode.PRICE_OUT_OF_RANGE,
        'O preço analisado não cabe no campo comercial do produto.',
        { field: 'versionId' },
      );
    }
  }

  private assertBelowMinimumAuthorization(
    role: OrganizationRole,
    classification: PricingClassification,
  ): void {
    if (classification !== PricingClassification.BELOW_MINIMUM) return;
    if (!BELOW_MINIMUM_ROLES.has(role)) {
      throw new PricingHttpException(
        HttpStatus.FORBIDDEN,
        PricingErrorCode.BELOW_MINIMUM_FORBIDDEN,
        'Seu papel não permite adotar preço abaixo do mínimo.',
      );
    }
  }

  private assertBelowMinimumEvidence(
    classification: PricingClassification,
    dto: CreatePricingAdoptionDto,
  ): void {
    if (classification !== PricingClassification.BELOW_MINIMUM) return;
    if (dto.belowMinimumConfirmed !== true) {
      throw new PricingHttpException(
        HttpStatus.BAD_REQUEST,
        PricingErrorCode.VALIDATION_ERROR,
        'Confirme explicitamente a adoção abaixo do mínimo.',
        { field: 'belowMinimumConfirmed' },
      );
    }
    if (
      typeof dto.justification !== 'string' ||
      dto.justification.trim() === ''
    ) {
      throw new PricingHttpException(
        HttpStatus.BAD_REQUEST,
        PricingErrorCode.JUSTIFICATION_REQUIRED,
        'Informe a justificativa para adotar o preço abaixo do mínimo.',
        { field: 'justification' },
      );
    }
  }

  private audit(
    transaction: Prisma.TransactionClient,
    data: {
      adoptionId: string;
      organizationId: string;
      actorUserId: string;
      productId: string;
      versionId: string;
      previousVersionId: string | null;
      classification: PricingClassification;
      belowMinimumConfirmed: boolean;
      previousPrice: Prisma.Decimal | null;
      newPrice: Prisma.Decimal;
    },
  ) {
    return transaction.auditLog.create({
      data: {
        organizationId: data.organizationId,
        actorUserId: data.actorUserId,
        action:
          data.classification === PricingClassification.BELOW_MINIMUM
            ? 'product_price.adopted_below_minimum'
            : 'product_price.adopted',
        entityType: 'product',
        entityId: data.productId,
        metadata: {
          adoptionId: data.adoptionId,
          productId: data.productId,
          versionId: data.versionId,
          previousVersionId: data.previousVersionId,
          classification: data.classification,
          belowMinimumConfirmed: data.belowMinimumConfirmed,
          previousPrice:
            data.previousPrice === null
              ? null
              : serializePricingDecimal(data.previousPrice),
          newPrice: serializePricingDecimal(data.newPrice),
          actorUserId: data.actorUserId,
        },
      },
    });
  }

  private response(
    productId: string,
    currency: string,
    salePrice: Prisma.Decimal,
    versionId: string,
    adoption: AdoptionRecord,
  ) {
    return {
      product: {
        id: productId,
        currency,
        salePrice: serializePricingDecimal(salePrice),
        adoptedPricingVersionId: versionId,
      },
      adoption: {
        ...adoption,
        previousPrice:
          adoption.previousPrice === null
            ? null
            : serializePricingDecimal(adoption.previousPrice),
        newPrice: serializePricingDecimal(adoption.newPrice),
        createdAt: adoption.createdAt.toISOString(),
      },
    };
  }

  private isConcurrentModification(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    );
  }

  private forbidden() {
    return new PricingHttpException(
      HttpStatus.FORBIDDEN,
      PricingErrorCode.PRICING_FORBIDDEN,
      'Você não tem permissão para realizar esta ação.',
    );
  }

  private productNotFound() {
    return new PricingHttpException(
      HttpStatus.NOT_FOUND,
      PricingErrorCode.PRODUCT_NOT_FOUND,
      'Produto não encontrado.',
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
