import {
  createPricingVersionInputSchema,
  createdPricingVersionSchema,
  pricingVersionDetailSchema,
  pricingVersionListSchema,
} from './pricing-versions-contracts';
import { pricingVersionFixture } from './pricing-versions-test-fixtures';

describe('pricing version contracts', () => {
  it('accepts only the revision and optional current price in creation', () => {
    expect(createPricingVersionInputSchema.parse({ expectedCompositionRevision: 3 })).toEqual({
      expectedCompositionRevision: 3,
    });
    expect(
      createPricingVersionInputSchema.parse({
        expectedCompositionRevision: 3,
        adoptedPrice: '88.5',
      }).adoptedPrice,
    ).toBe('88.5');
    for (const field of ['snapshot', 'draft', 'organizationId', 'formulaVersion', 'isAdopted']) {
      expect(
        createPricingVersionInputSchema.safeParse({ expectedCompositionRevision: 3, [field]: {} })
          .success,
      ).toBe(false);
    }
  });

  it('validates the entire snapshot and separates POST from GET isAdopted', () => {
    const created = pricingVersionFixture();
    expect(
      created.snapshot.context.configuration.fixedCosts?.mode === 'RATE' &&
        created.snapshot.context.configuration.fixedCosts.rate,
    ).toBe('0.00000001');
    expect(created.snapshot.context.componentOrigins[0]?.position).toBe(1);
    expect(created).not.toHaveProperty('isAdopted');
    expect(createdPricingVersionSchema.safeParse({ ...created, isAdopted: false }).success).toBe(
      false,
    );
    expect(pricingVersionDetailSchema.parse({ ...created, isAdopted: true }).isAdopted).toBe(true);
    expect(pricingVersionDetailSchema.safeParse(created).success).toBe(false);
    expect(
      createdPricingVersionSchema.safeParse({
        ...created,
        snapshot: { ...created.snapshot, secretSql: 'SELECT *' },
      }).success,
    ).toBe(false);
    expect(createdPricingVersionSchema.safeParse({ ...created, components: [] }).success).toBe(
      false,
    );
    expect(
      createdPricingVersionSchema.safeParse({
        ...created,
        snapshot: {
          ...created.snapshot,
          input: { ...created.snapshot.input, desiredMargin: 0.25 },
        },
      }).success,
    ).toBe(false);
    expect(
      createdPricingVersionSchema.safeParse({
        ...created,
        snapshot: {
          ...created.snapshot,
          input: { ...created.snapshot.input, desiredMargin: '1e-8' },
        },
      }).success,
    ).toBe(false);
  });

  it('validates a paginated list without snapshots', () => {
    const {
      id,
      number,
      compositionRevision,
      minimumPriceCommercial,
      suggestedPriceCommercial,
      analyzedPrice,
      classification,
      formulaVersion,
      snapshotSchemaVersion,
      currency,
      finalizedAt,
      createdByUserId,
      createdAt,
    } = pricingVersionFixture();
    const item = {
      id,
      number,
      compositionRevision,
      minimumPriceCommercial,
      suggestedPriceCommercial,
      analyzedPrice,
      classification,
      formulaVersion,
      snapshotSchemaVersion,
      currency,
      finalizedAt,
      createdByUserId,
      createdAt,
      isAdopted: false,
    };
    const list = { data: [item], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } };
    expect(pricingVersionListSchema.parse(list).data[0]?.isAdopted).toBe(false);
    expect(
      pricingVersionListSchema.safeParse({ ...list, data: [{ ...item, snapshot: {} }] }).success,
    ).toBe(false);
    expect(
      pricingVersionListSchema.safeParse({ ...list, data: [{ ...item, finalizedAt: 'yesterday' }] })
        .success,
    ).toBe(false);
  });

  it('accepts the API text columns with exactly two decimal places, including final zeros', () => {
    const created = pricingVersionFixture();
    const withFinalZero = {
      ...created,
      minimumPriceCommercial: '90.90',
      snapshot: {
        ...created.snapshot,
        result: {
          ...created.snapshot.result,
          minimumPrice: { ...created.snapshot.result.minimumPrice, commercial: '90.90' },
        },
      },
    };
    expect(createdPricingVersionSchema.safeParse(withFinalZero).success).toBe(true);
    expect(
      createdPricingVersionSchema.safeParse({ ...withFinalZero, minimumPriceCommercial: '90.9' })
        .success,
    ).toBe(false);
    const item = {
      id: created.id,
      number: created.number,
      compositionRevision: created.compositionRevision,
      minimumPriceCommercial: '90.90',
      suggestedPriceCommercial: created.suggestedPriceCommercial,
      analyzedPrice: created.analyzedPrice,
      classification: created.classification,
      formulaVersion: created.formulaVersion,
      snapshotSchemaVersion: created.snapshotSchemaVersion,
      currency: created.currency,
      finalizedAt: created.finalizedAt,
      createdByUserId: created.createdByUserId,
      createdAt: created.createdAt,
      isAdopted: false,
    };
    expect(
      pricingVersionListSchema.safeParse({
        data: [item],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }).success,
    ).toBe(true);
  });

  it('rejects incomplete projections and accepts signed exact financial results', () => {
    const created = pricingVersionFixture();
    const negative = {
      ...created,
      snapshot: {
        ...created.snapshot,
        result: {
          ...created.snapshot.result,
          analysis: {
            ...created.snapshot.result.analysis,
            profit: { exact: '-1.00000001', display: '-1.00' },
          },
        },
      },
    };
    expect(createdPricingVersionSchema.safeParse(negative).success).toBe(true);
    expect(createdPricingVersionSchema.safeParse({ ...created, componentCount: 2 }).success).toBe(
      false,
    );
    expect(
      createdPricingVersionSchema.safeParse({
        ...created,
        snapshot: {
          ...created.snapshot,
          context: { ...created.snapshot.context, componentOrigins: [] },
        },
      }).success,
    ).toBe(false);
    expect(
      createdPricingVersionSchema.safeParse({
        ...created,
        components: [{ ...created.components[0], position: 2 }],
      }).success,
    ).toBe(false);
  });

  it('rejects projections or provenances that disagree with the frozen snapshot', () => {
    const created = pricingVersionFixture();
    const component = created.components[0]!;
    expect(
      createdPricingVersionSchema.safeParse({
        ...created,
        components: [{ ...component, totalExact: '999' }],
      }).success,
    ).toBe(false);
    expect(
      createdPricingVersionSchema.safeParse({
        ...created,
        components: [
          { ...component, originDetails: { ...component.originDetails, source: 'other' } },
        ],
      }).success,
    ).toBe(false);
    expect(
      createdPricingVersionSchema.safeParse({
        ...created,
        snapshot: {
          ...created.snapshot,
          context: {
            ...created.snapshot.context,
            componentOrigins: [
              {
                ...created.snapshot.context.componentOrigins[0],
                origin: component.costSource === 'CATALOG' ? 'MANUAL' : 'CATALOG',
              },
            ],
          },
        },
      }).success,
    ).toBe(false);
    expect(
      createdPricingVersionSchema.safeParse({
        ...created,
        snapshot: {
          ...created.snapshot,
          input: {
            ...created.snapshot.input,
            components: [{ ...created.snapshot.input.components[0], quantity: '999' }],
          },
        },
      }).success,
    ).toBe(false);
  });
});
