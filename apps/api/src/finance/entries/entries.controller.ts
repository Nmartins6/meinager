import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrganizationRoles } from '../../auth/authorization/organization-roles.decorator.js';
import { OrganizationRolesGuard } from '../../auth/authorization/organization-roles.guard.js';
import { SessionAuthGuard } from '../../auth/session/session-auth.guard.js';
import type { AuthenticatedRequest } from '../../auth/session/session.types.js';
import { OrganizationRole } from '../../generated/prisma/enums.js';
import { CreateEntryDto } from './dto/create-entry.dto.js';
import { ListEntriesQueryDto } from './dto/list-entries-query.dto.js';
import { EntriesService } from './entries.service.js';

@Controller('finance/entries')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Get()
  findAll(
    @Query() query: ListEntriesQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.entriesService.findAll(request.auth.organization.id, query);
  }

  @Post()
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.FINANCE,
  )
  create(@Body() dto: CreateEntryDto, @Req() request: AuthenticatedRequest) {
    return this.entriesService.create(
      request.auth.organization.id,
      request.auth.user.id,
      dto,
    );
  }
}
