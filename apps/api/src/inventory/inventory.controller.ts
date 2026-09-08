import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { OrganizationRoles } from '../auth/authorization/organization-roles.decorator.js';
import { OrganizationRolesGuard } from '../auth/authorization/organization-roles.guard.js';
import { SessionAuthGuard } from '../auth/session/session-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/session/session.types.js';
import { OrganizationRole } from '../generated/prisma/enums.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto.js';
import { InventoryService } from './inventory.service.js';
import { ReverseStockMovementDto } from './dto/reverse-stock-movement.dto.js';

@Controller('inventory/products/:productId')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('movements')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  create(
    @Param('productId', new ParseUUIDPipe({ version: '4' }))
    productId: string,
    @Body() dto: CreateStockMovementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryService.create(
      request.auth.organization.id,
      request.auth.user.id,
      productId,
      dto,
    );
  }

    @Post('movements/:movementId/reverse')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  reverse(
    @Param('productId', new ParseUUIDPipe({ version: '4' }))
    productId: string,
    @Param('movementId', new ParseUUIDPipe({ version: '4' }))
    movementId: string,
    @Body() dto: ReverseStockMovementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryService.reverse(
      request.auth.organization.id,
      request.auth.user.id,
      productId,
      movementId,
      dto,
    );
  }

  @Get('movements')
  findAll(
    @Param('productId', new ParseUUIDPipe({ version: '4' }))
    productId: string,
    @Query() query: ListStockMovementsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryService.findAll(
      request.auth.organization.id,
      productId,
      query,
    );
  }

  @Get('balance')
  getBalance(
    @Param('productId', new ParseUUIDPipe({ version: '4' }))
    productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryService.getBalance(
      request.auth.organization.id,
      productId,
    );
  }
}