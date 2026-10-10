import { HttpStatus, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import {
  PricingErrorCode,
  PricingHttpException,
} from '../errors/pricing-http.exception.js';
import { serializePricingDecimal } from '../pricing-decimal-serialization.js';

export interface PricingProductSummaryResponse {
  productId: string;
  currency: 'BRL';
  salePrice: string | null;
  priceOrigin: 'MANUAL' | 'PRICING_VERSION';
  hasComposition: boolean;
}

@Injectable()
export class PricingProductSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(
    organizationId: string,
    productId: string,
  ): Promise<PricingProductSummaryResponse> {
    const product = await this.prisma.product.findFirst({
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

    if (!product) {
      throw new PricingHttpException(
        HttpStatus.NOT_FOUND,
        PricingErrorCode.PRODUCT_NOT_FOUND,
        'Produto não encontrado.',
      );
    }

    return {
      productId: product.id,
      currency: 'BRL',
      salePrice: product.salePrice
        ? serializePricingDecimal(product.salePrice)
        : null,
      priceOrigin: product.adoptedPricingVersionId
        ? 'PRICING_VERSION'
        : 'MANUAL',
      hasComposition: product.pricingCompositions.length > 0,
    };
  }
}
