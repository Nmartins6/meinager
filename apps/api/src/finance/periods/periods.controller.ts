import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreatePeriodDto } from './dto/create-period.dto.js';
import { ListPeriodsQueryDto } from './dto/list-periods-query.dto.js';
import { UpdatePeriodDto } from './dto/update-period.dto.js';
import { PeriodsService } from './periods.service.js';

@Controller('finance/periods')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Get()
  findAll(
    @Query() query: ListPeriodsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.periodsService.findAll(request.auth.organization.id, query);
  }

  @Post()
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.FINANCE,
  )
  create(@Body() dto: CreatePeriodDto, @Req() request: AuthenticatedRequest) {
    return this.periodsService.create(
      request.auth.organization.id,
      request.auth.user.id,
      dto,
    );
  }

  @Patch(':id')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.FINANCE,
  )
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) periodId: string,
    @Body() dto: UpdatePeriodDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.periodsService.update(
      request.auth.organization.id,
      request.auth.user.id,
      periodId,
      dto,
    );
  }

  @Post(':id/close')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.FINANCE,
  )
  close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) periodId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.periodsService.close(
      request.auth.organization.id,
      request.auth.user.id,
      periodId,
    );
  }

  @Post(':id/reopen')
  @OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  reopen(
    @Param('id', new ParseUUIDPipe({ version: '4' })) periodId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.periodsService.reopen(
      request.auth.organization.id,
      request.auth.user.id,
      periodId,
    );
  }
}
