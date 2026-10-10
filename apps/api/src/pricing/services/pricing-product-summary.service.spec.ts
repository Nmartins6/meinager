import type { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PricingErrorCode } from '../errors/pricing-http.exception.js';
import { PricingProductSummaryService } from './pricing-product-summary.service.js';

describe('PricingProductSummaryService', () => {
  const organizationId = '00000000-0000-4000-8000-000000000001';
  const productId = '00000000-0000-4000-8000-000000000002';
  const versionId = '00000000-0000-4000-8000-000000000003';
  const compositionId = '00000000-0000-4000-8000-000000000004';

  const product = { findFirst: vi.fn() };
  const service = new PricingProductSummaryService({
    product,
  } as unknown as PrismaService);

  beforeEach(() => vi.resetAllMocks());

  it('returns the exact manual-price contract without internal fields', async () => {
    product.findFirst.mockResolvedValue({
      id: productId,
      salePrice: new Prisma.Decimal('19.90'),
      adoptedPricingVersionId: null,
      pricingCompositions: [],
    });

    await expect(service.findOne(organizationId, productId)).resolves.toEqual({
      productId,
      currency: 'BRL',
      salePrice: '19.9',
      priceOrigin: 'MANUAL',
      hasComposition: false,
    });

    expect(product.findFirst).toHaveBeenCalledWith({
      where: { organizationId, id: productId },
      select: {
        id: true,
        salePrice: true,
        adoptedPricingVersionId: true,
        pricingCompositions: {
          take: 1,
          select: { id: true },
        },
      },
    });
  });

  it('reports pricing-version origin, null price, and composition existence', async () => {
    product.findFirst.mockResolvedValue({
      id: productId,
      salePrice: null,
      adoptedPricingVersionId: versionId,
      pricingCompositions: [{ id: compositionId }],
    });

    await expect(service.findOne(organizationId, productId)).resolves.toEqual({
      productId,
      currency: 'BRL',
      salePrice: null,
      priceOrigin: 'PRICING_VERSION',
      hasComposition: true,
    });
  });

  it('returns PRODUCT_NOT_FOUND outside the organization boundary', async () => {
    product.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne(organizationId, productId),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: PricingErrorCode.PRODUCT_NOT_FOUND },
    });
  });
});
