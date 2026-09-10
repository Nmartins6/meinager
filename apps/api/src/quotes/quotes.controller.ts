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

import { OrganizationRoles } from '../auth/authorization/organization-roles.decorator.js';
import { OrganizationRolesGuard } from '../auth/authorization/organization-roles.guard.js';
import { SessionAuthGuard } from '../auth/session/session-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/session/session.types.js';
import { OrganizationRole } from '../generated/prisma/enums.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { ListQuotesQueryDto } from './dto/list-quotes-query.dto.js';
import { QuotesService } from './quotes.service.js';
import { UpdateQuoteDto } from './dto/update-quote.dto.js';

@Controller('quotes')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  findAll(
    @Query() query: ListQuotesQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quotesService.findAll(
      request.auth.organization.id,
      request.auth.user.id,
      query,
    );
  }

  @Get(':quoteId')
  findOne(
    @Param('quoteId', new ParseUUIDPipe({ version: '4' }))
    quoteId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quotesService.findOne(
      request.auth.organization.id,
      request.auth.user.id,
      quoteId,
    );
  }

  @Post(':quoteId/send')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  send(
    @Param('quoteId', new ParseUUIDPipe({ version: '4' }))
    quoteId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quotesService.send(
      request.auth.organization.id,
      request.auth.user.id,
      quoteId,
    );
  }

  @Post(':quoteId/approve')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  approve(
    @Param('quoteId', new ParseUUIDPipe({ version: '4' }))
    quoteId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quotesService.approve(
      request.auth.organization.id,
      request.auth.user.id,
      quoteId,
    );
  }

  @Post(':quoteId/reject')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  reject(
    @Param('quoteId', new ParseUUIDPipe({ version: '4' }))
    quoteId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quotesService.reject(
      request.auth.organization.id,
      request.auth.user.id,
      quoteId,
    );
  }

  @Post(':quoteId/cancel')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  cancel(
    @Param('quoteId', new ParseUUIDPipe({ version: '4' }))
    quoteId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quotesService.cancel(
      request.auth.organization.id,
      request.auth.user.id,
      quoteId,
    );
  }

  @Post()
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  create(@Body() dto: CreateQuoteDto, @Req() request: AuthenticatedRequest) {
    return this.quotesService.create(
      request.auth.organization.id,
      request.auth.user.id,
      dto,
    );
  }

  @Patch(':quoteId')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  update(
    @Param('quoteId', new ParseUUIDPipe({ version: '4' }))
    quoteId: string,
    @Body() dto: UpdateQuoteDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quotesService.update(
      request.auth.organization.id,
      request.auth.user.id,
      quoteId,
      dto,
    );
  }
}
