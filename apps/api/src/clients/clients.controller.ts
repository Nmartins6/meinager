import {
  Body,
  Controller,
  Get,
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
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { ListClientsQueryDto } from './dto/list-clients-query.dto.js';

@Controller('clients')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(
    @Query() query: ListClientsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.clientsService.findAll(request.auth.organization.id, query);
  }

  @Post()
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.FINANCE,
    OrganizationRole.OPERATIONS,
  )
  create(@Body() dto: CreateClientDto, @Req() request: AuthenticatedRequest) {
    return this.clientsService.create(
      request.auth.organization.id,
      request.auth.user.id,
      dto,
    );
  }
}
