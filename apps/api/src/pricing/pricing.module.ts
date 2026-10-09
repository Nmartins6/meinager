import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PricingConfigurationController } from './controllers/pricing-configuration.controller.js';
import { PricingProfilesController } from './controllers/pricing-profiles.controller.js';
import { ProductPricingController } from './controllers/product-pricing.controller.js';
import { PricingConfigurationService } from './services/pricing-configuration.service.js';
import { PricingCompositionsService } from './services/pricing-compositions.service.js';
import { PricingCalculationsService } from './services/pricing-calculations.service.js';
import { PricingProfilesService } from './services/pricing-profiles.service.js';
import { PricingVersionsService } from './services/pricing-versions.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    PricingConfigurationController,
    PricingProfilesController,
    ProductPricingController,
  ],
  providers: [
    PricingConfigurationService,
    PricingProfilesService,
    PricingCompositionsService,
    PricingCalculationsService,
    PricingVersionsService,
  ],
})
export class PricingModule {}
