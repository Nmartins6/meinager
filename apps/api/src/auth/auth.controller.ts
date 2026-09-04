import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

interface SessionCookie {
  token: string;
  expiresAt: Date;
}

@Controller('auth')
export class AuthController {
  private readonly sessionCookieName: string;

  constructor(
    private readonly authService: AuthService,
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
