import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { OrganizationRoles } from '../auth/authorization/organization-roles.decorator.js';
import { OrganizationRolesGuard } from '../auth/authorization/organization-roles.guard.js';
import { SessionAuthGuard } from '../auth/session/session-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/session/session.types.js';
import { OrganizationRole } from '../generated/prisma/enums.js';
import { CreateOrderWorkflowDto } from './dto/create-order-workflow.dto.js';
import { OrderWorkflowsService } from './order-workflows.service.js';

@Controller('order-workflows')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class OrderWorkflowsController {
  constructor(private readonly orderWorkflowsService: OrderWorkflowsService) {}

  @Get()
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  findAll(@Req() request: AuthenticatedRequest) {
    return this.orderWorkflowsService.findAll(request.auth.organization.id);
  }

  @Get('active')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  findActive(@Req() request: AuthenticatedRequest) {
    return this.orderWorkflowsService.findActive(request.auth.organization.id);
  }

  @Post()
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  create(
    @Body() dto: CreateOrderWorkflowDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.orderWorkflowsService.create(
      request.auth.organization.id,
      request.auth.user.id,
      dto,
    );
  }

  @Post(':workflowId/default')
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  setDefault(
    @Param('workflowId', new ParseUUIDPipe({ version: '4' }))
    workflowId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.orderWorkflowsService.setDefault(
      request.auth.organization.id,
      request.auth.user.id,
      workflowId,
    );
  }

  @Post(':workflowId/activate')
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  activate(
    @Param('workflowId', new ParseUUIDPipe({ version: '4' }))
    workflowId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.orderWorkflowsService.activate(
      request.auth.organization.id,
      request.auth.user.id,
      workflowId,
    );
  }

  @Post(':workflowId/deactivate')
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  deactivate(
    @Param('workflowId', new ParseUUIDPipe({ version: '4' }))
    workflowId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.orderWorkflowsService.deactivate(
      request.auth.organization.id,
      request.auth.user.id,
      workflowId,
    );
  }
}
