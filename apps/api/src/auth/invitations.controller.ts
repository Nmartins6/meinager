import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OrganizationRole } from '../generated/prisma/enums.js';
import { OrganizationRoles } from './authorization/organization-roles.decorator.js';
import { OrganizationRolesGuard } from './authorization/organization-roles.guard.js';
import {
  CreateInvitationDto,
  RegisterInvitedDto,
} from './dto/invitation.dto.js';
import { InvitationsService } from './invitations.service.js';
import { SessionAuthGuard } from './session/session-auth.guard.js';
import type { AuthenticatedRequest } from './session/session.types.js';
import {
  SessionUserGuard,
  type UserSessionRequest,
} from './session/session-user.guard.js';

@Controller('organization/invitations')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
@OrganizationRoles(OrganizationRole.OWNER)
export class OrganizationInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitations.create(
      request.auth.organization.id,
      request.auth.user.id,
      dto,
    );
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.invitations.list(request.auth.organization.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.invitations.revoke(
      request.auth.organization.id,
      request.auth.user.id,
      id,
    );
  }
}

@Controller('auth/invitations')
export class InvitationAcceptanceController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':token')
  inspect(@Param('token') token: string) {
    return this.invitations.inspect(token);
  }

  @Post(':token/register')
  async register(
    @Param('token') token: string,
    @Body() dto: RegisterInvitedDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.invitations.register(token, dto, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
    response.cookie(
      process.env['SESSION_COOKIE_NAME'] ?? 'meinager_session',
      result.session.token,
      {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        expires: result.session.expiresAt,
        path: '/',
      },
    );
    return {
      user: result.user,
      organization: null,
      organizations: [],
      contextVersion: result.session.contextVersion,
    };
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionUserGuard)
  accept(@Param('token') token: string, @Req() request: UserSessionRequest) {
    return this.invitations.accept(
      token,
      request.userSession.user.id,
      request.userSession.user.email,
    );
  }
}
