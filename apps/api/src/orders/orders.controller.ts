import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import { OrganizationRoles } from '../auth/authorization/organization-roles.decorator.js';
import { OrganizationRolesGuard } from '../auth/authorization/organization-roles.guard.js';
import { SessionAuthGuard } from '../auth/session/session-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/session/session.types.js';
import { OrganizationRole } from '../generated/prisma/enums.js';
import { CreateOrderFromQuoteDto } from './dto/create-order-from-quote.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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
