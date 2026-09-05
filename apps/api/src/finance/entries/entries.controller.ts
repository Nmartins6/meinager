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
  Patch,
} from '@nestjs/common';
import { OrganizationRoles } from '../../auth/authorization/organization-roles.decorator.js';
import { OrganizationRolesGuard } from '../../auth/authorization/organization-roles.guard.js';
import { SessionAuthGuard } from '../../auth/session/session-auth.guard.js';
import type { AuthenticatedRequest } from '../../auth/session/session.types.js';
import { OrganizationRole } from '../../generated/prisma/enums.js';
import { CreateEntryDto } from './dto/create-entry.dto.js';
import { ListEntriesQueryDto } from './dto/list-entries-query.dto.js';
import { EntriesService } from './entries.service.js';
import { UpdateEntryDto } from './dto/update-entry.dto.js';
import { CancelEntryDto } from './dto/cancel-entry.dto.js';

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

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) entryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.entriesService.findOne(request.auth.organization.id, entryId);
  }

  @Patch(':id')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.FINANCE,
  )
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) entryId: string,
    @Body() dto: UpdateEntryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.entriesService.update(
      request.auth.organization.id,
      request.auth.user.id,
      entryId,
      dto,
    );
  }

  @Post(':id/cancel')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.FINANCE,
  )
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) entryId: string,
    @Body() dto: CancelEntryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.entriesService.cancel(
      request.auth.organization.id,
      request.auth.user.id,
      entryId,
      dto,
    );
  }

  @Post(':id/duplicate-next-month')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.FINANCE,
  )
  duplicateToNextMonth(
    @Param('id', new ParseUUIDPipe({ version: '4' })) entryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.entriesService.duplicateToNextMonth(
      request.auth.organization.id,
      request.auth.user.id,
      entryId,
    );
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
