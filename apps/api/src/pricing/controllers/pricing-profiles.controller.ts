import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { OrganizationRoles } from '../../auth/authorization/organization-roles.decorator.js';
import { OrganizationRolesGuard } from '../../auth/authorization/organization-roles.guard.js';
import { SessionAuthGuard } from '../../auth/session/session-auth.guard.js';
import type { AuthenticatedRequest } from '../../auth/session/session.types.js';
import { OrganizationRole } from '../../generated/prisma/enums.js';
import {
  CreatePricingProfileDto,
  DeactivatePricingProfileDto,
  ListPricingProfilesQueryDto,
  UpdatePricingProfileDto,
} from '../dto/pricing-profiles.dto.js';
import { PricingExceptionFilter } from '../errors/pricing-exception.filter.js';
import { PricingProfilesService } from '../services/pricing-profiles.service.js';

const READ_ROLES = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.OPERATIONS,
  OrganizationRole.FINANCE,
];

@Controller('pricing/profiles')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
@UseFilters(PricingExceptionFilter)
export class PricingProfilesController {
  constructor(private readonly profiles: PricingProfilesService) {}

  @Get()
  @OrganizationRoles(...READ_ROLES)
  findAll(
    @Query() query: ListPricingProfilesQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.profiles.findAll(request.auth.organization.id, query);
  }

  @Get(':profileId')
  @OrganizationRoles(...READ_ROLES)
  findOne(
    @Param('profileId', new ParseUUIDPipe({ version: '4' })) profileId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.profiles.findOne(request.auth.organization.id, profileId);
  }

  @Post()
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  create(
    @Body() dto: CreatePricingProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.profiles.create(
      request.auth.organization.id,
      request.auth.user.id,
      dto,
    );
  }

  @Patch(':profileId')
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  update(
    @Param('profileId', new ParseUUIDPipe({ version: '4' })) profileId: string,
    @Body() dto: UpdatePricingProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.profiles.update(
      request.auth.organization.id,
      request.auth.user.id,
      profileId,
      dto,
    );
  }

  @Post(':profileId/deactivate')
  @HttpCode(200)
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  deactivate(
    @Param('profileId', new ParseUUIDPipe({ version: '4' })) profileId: string,
    @Body() dto: DeactivatePricingProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.profiles.deactivate(
      request.auth.organization.id,
      request.auth.user.id,
      profileId,
      dto,
    );
  }
}
