import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SessionService } from './session.service.js';
import type { AuthenticatedRequest } from './session.types.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  private readonly sessionCookieName: string;

  constructor(
    private readonly sessionService: SessionService,
    configService: ConfigService,
  ) {
    this.sessionCookieName =
      configService.get<string>('SESSION_COOKIE_NAME') ?? 'meinager_session';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token: unknown = request.cookies?.[this.sessionCookieName];

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    const authenticatedSession =
      await this.sessionService.findAuthenticated(token);

    if (!authenticatedSession) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    (request as AuthenticatedRequest).auth = authenticatedSession;

    return true;
  }
}
