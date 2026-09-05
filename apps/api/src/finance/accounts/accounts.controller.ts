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
import { AccountsService } from './accounts.service.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

@Controller('finance/accounts')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll(
    @Query() query: ListAccountsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accountsService.findAll(request.auth.organization.id, query);
  }

  @Post()
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.FINANCE,
  )
  create(@Body() dto: CreateAccountDto, @Req() request: AuthenticatedRequest) {
    return this.accountsService.create(
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
    @Param('id', new ParseUUIDPipe({ version: '4' })) accountId: string,
    @Body() dto: UpdateAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accountsService.update(
      request.auth.organization.id,
      request.auth.user.id,
      accountId,
      dto,
    );
  }
}
