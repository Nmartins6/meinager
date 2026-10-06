import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PricingConfigurationController } from './controllers/pricing-configuration.controller.js';
import { PricingProfilesController } from './controllers/pricing-profiles.controller.js';
import { PricingConfigurationService } from './services/pricing-configuration.service.js';
import { PricingProfilesService } from './services/pricing-profiles.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PricingConfigurationController, PricingProfilesController],
  providers: [PricingConfigurationService, PricingProfilesService],
})
export class PricingModule {}
