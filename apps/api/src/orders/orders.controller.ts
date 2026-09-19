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
import { CreateOrderFromQuoteDto } from './dto/create-order-from-quote.dto.js';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(
    @Query() query: ListOrdersQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ordersService.findAll(request.auth.organization.id, query);
  }

  @Get(':orderId')
  findOne(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ordersService.findOne(request.auth.organization.id, orderId);
  }

  @Post(':orderId/advance')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  advance(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ordersService.advance(
      request.auth.organization.id,
      request.auth.user.id,
      orderId,
    );
  }

  @Post(':orderId/cancel')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  cancel(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ordersService.cancel(
      request.auth.organization.id,
      request.auth.user.id,
      orderId,
    );
  }

  @Post()
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  createFromQuote(
    @Body() dto: CreateOrderFromQuoteDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ordersService.createFromQuote(
      request.auth.organization.id,
      request.auth.user.id,
      dto,
    );
  }
}
