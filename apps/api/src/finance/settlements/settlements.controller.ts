import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  Get,
} from '@nestjs/common';
import { OrganizationRoles } from '../../auth/authorization/organization-roles.decorator.js';
import { OrganizationRolesGuard } from '../../auth/authorization/organization-roles.guard.js';
import { SessionAuthGuard } from '../../auth/session/session-auth.guard.js';
import type { AuthenticatedRequest } from '../../auth/session/session.types.js';
import { OrganizationRole } from '../../generated/prisma/enums.js';
import { CreateSettlementDto } from './dto/create-settlement.dto.js';
import { SettlementsService } from './settlements.service.js';
import { ReverseSettlementDto } from './dto/reverse-settlement.dto.js';

@Controller('finance')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get('entries/:entryId/settlements')
  findAll(
    @Param('entryId', new ParseUUIDPipe({ version: '4' }))
    entryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settlementsService.findAll(
      request.auth.organization.id,
      entryId,
    );
  }

  @Post('settlements/:settlementId/reverse')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.FINANCE,
  )
  reverse(
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
    @Body() dto: ReverseSettlementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settlementsService.reverse(
      request.auth.organization.id,
      request.auth.user.id,
      settlementId,
      dto,
    );
  }

  @Post('entries/:entryId/settlements')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.FINANCE,
  )
  create(
    @Param('entryId', new ParseUUIDPipe({ version: '4' }))
    entryId: string,
    @Body() dto: CreateSettlementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settlementsService.create(
      request.auth.organization.id,
      request.auth.user.id,
      entryId,
      dto,
    );
  }
}
