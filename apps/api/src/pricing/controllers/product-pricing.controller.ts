import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { PutPricingCompositionDto } from '../dto/pricing-composition.dto.js';
import { CreatePricingAdoptionDto } from '../dto/pricing-adoption.dto.js';
import { CreatePricingSimulationDto } from '../dto/pricing-simulation.dto.js';
import {
  CreatePricingVersionDto,
  ListPricingVersionsQueryDto,
} from '../dto/pricing-version.dto.js';
import { PricingExceptionFilter } from '../errors/pricing-exception.filter.js';
import { PricingCompositionsService } from '../services/pricing-compositions.service.js';
import { PricingCalculationsService } from '../services/pricing-calculations.service.js';
import { PricingAdoptionsService } from '../services/pricing-adoptions.service.js';
import { PricingVersionsService } from '../services/pricing-versions.service.js';

const INTERNAL_READ_ROLES = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.OPERATIONS,
  OrganizationRole.FINANCE,
];

@Controller('pricing/products/:productId')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
@UseFilters(PricingExceptionFilter)
export class ProductPricingController {
  constructor(
    private readonly compositions: PricingCompositionsService,
    private readonly calculations: PricingCalculationsService,
    private readonly versions: PricingVersionsService,
    private readonly adoptions: PricingAdoptionsService,
  ) {}

  @Post('adoptions')
  @HttpCode(HttpStatus.OK)
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  adopt(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: CreatePricingAdoptionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adoptions.adopt(
      request.auth.organization.id,
      request.auth.user.id,
      request.auth.organization.role,
      productId,
      dto,
    );
  }

  @Post('versions')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  createVersion(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: CreatePricingVersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.versions.create(
      request.auth.organization.id,
      request.auth.user.id,
      productId,
      dto,
    );
  }

  @Get('versions')
  @OrganizationRoles(...INTERNAL_READ_ROLES)
  findVersions(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Query() query: ListPricingVersionsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.versions.findAll(
      request.auth.organization.id,
      productId,
      query,
    );
  }

  @Get('versions/:versionId')
  @OrganizationRoles(...INTERNAL_READ_ROLES)
  findVersion(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.versions.findOne(
      request.auth.organization.id,
      productId,
      versionId,
    );
  }

  @Post('simulations')
  @HttpCode(HttpStatus.OK)
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  simulate(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: CreatePricingSimulationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.calculations.simulate(
      request.auth.organization.id,
      request.auth.user.id,
      productId,
      dto,
    );
  }

  @Get('composition')
  @OrganizationRoles(...INTERNAL_READ_ROLES)
  findCurrent(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.compositions.findCurrent(
      request.auth.organization.id,
      productId,
    );
  }

  @Put('composition')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  replace(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: PutPricingCompositionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.compositions.replace(
      request.auth.organization.id,
      request.auth.user.id,
      productId,
      dto,
    );
  }
}
