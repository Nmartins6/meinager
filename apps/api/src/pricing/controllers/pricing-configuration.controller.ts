import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { OrganizationRoles } from '../../auth/authorization/organization-roles.decorator.js';
import { OrganizationRolesGuard } from '../../auth/authorization/organization-roles.guard.js';
import { SessionAuthGuard } from '../../auth/session/session-auth.guard.js';
import type { AuthenticatedRequest } from '../../auth/session/session.types.js';
import { OrganizationRole } from '../../generated/prisma/enums.js';
import { UpdatePricingConfigurationDto } from '../dto/update-pricing-configuration.dto.js';
import { PricingExceptionFilter } from '../errors/pricing-exception.filter.js';
import { PricingConfigurationService } from '../services/pricing-configuration.service.js';

@Controller('pricing/configuration')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
@UseFilters(PricingExceptionFilter)
export class PricingConfigurationController {
  constructor(
    private readonly pricingConfigurationService: PricingConfigurationService,
  ) {}

  @Get()
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
    OrganizationRole.FINANCE,
  )
  findCurrent(@Req() request: AuthenticatedRequest) {
    return this.pricingConfigurationService.findCurrent(
      request.auth.organization.id,
    );
  }

  @Patch()
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  update(
    @Body() dto: UpdatePricingConfigurationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.pricingConfigurationService.update(
      request.auth.organization.id,
      request.auth.user.id,
      dto,
    );
  }
}
