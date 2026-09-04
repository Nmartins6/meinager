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
import { SessionAuthGuard } from './session/session-auth.guard.js';
import type { AuthenticatedRequest } from './session/session.types.js';
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
    };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return {
      user: request.auth.user,
      organization: request.auth.organization,
    };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @UseGuards(SessionAuthGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessionService.revokeById(request.auth.sessionId);

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
