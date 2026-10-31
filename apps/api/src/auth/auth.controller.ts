import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import {
  SessionUserGuard,
  type UserSessionRequest,
} from './session/session-user.guard.js';
import { SelectOrganizationDto } from './dto/select-organization.dto.js';
import { SessionService } from './session/session.service.js';

interface SessionCookie {
  token: string;
  expiresAt: Date;
}

@Controller('auth')
export class AuthController {
  private readonly sessionCookieName: string;

  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    configService: ConfigService,
  ) {
    this.sessionCookieName =
      configService.get<string>('SESSION_COOKIE_NAME') ?? 'meinager_session';
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, organization, session } = await this.authService.register(
      dto,
      {
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      },
    );

    this.setSessionCookie(response, session);

    return {
      user,
      organization,
      contextVersion: session.contextVersion,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, organization, session } = await this.authService.login(dto, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });

    this.setSessionCookie(response, session);

    return {
      user,
      organization,
      contextVersion: session.contextVersion,
    };
  }

  @Get('me')
  @UseGuards(SessionUserGuard)
  async getCurrentUser(@Req() request: UserSessionRequest) {
    const organizations = await this.sessionService.listOrganizations(
      request.userSession.user.id,
    );
    return {
      user: request.userSession.user,
      organization:
        organizations.find(
          (item) => item.id === request.userSession.activeOrganizationId,
        ) ?? null,
      organizations,
      contextVersion: request.userSession.contextVersion,
    };
  }

  @Get('organizations')
  @UseGuards(SessionUserGuard)
  listOrganizations(@Req() request: UserSessionRequest) {
    return this.sessionService.listOrganizations(request.userSession.user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('organization')
  @UseGuards(SessionUserGuard)
  async selectOrganization(
    @Body() dto: SelectOrganizationDto,
    @Req() request: UserSessionRequest,
  ) {
    const { contextVersion, ...organization } =
      await this.sessionService.switchOrganization(
        request.userSession.id,
        request.userSession.user.id,
        dto.organizationId,
      );
    return { user: request.userSession.user, organization, contextVersion };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @UseGuards(SessionUserGuard)
  async logout(
    @Req() request: UserSessionRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessionService.revokeById(request.userSession.id);

    response.clearCookie(this.sessionCookieName, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  private setSessionCookie(response: Response, session: SessionCookie): void {
    response.cookie(this.sessionCookieName, session.token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      expires: session.expiresAt,
      path: '/',
    });
  }
}
