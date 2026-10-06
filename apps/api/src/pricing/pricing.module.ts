import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PricingConfigurationController } from './controllers/pricing-configuration.controller.js';
import { PricingConfigurationService } from './services/pricing-configuration.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PricingConfigurationController],
  providers: [PricingConfigurationService],
})
export class PricingModule {}
