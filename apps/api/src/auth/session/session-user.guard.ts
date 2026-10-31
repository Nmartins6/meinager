import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SessionService } from './session.service.js';

export interface UserSessionRequest extends Request {
  userSession: {
    id: string;
    activeOrganizationId: string | null;
    contextVersion: number;
    user: { id: string; name: string; email: string };
  };
}

@Injectable()
export class SessionUserGuard implements CanActivate {
  private readonly cookieName: string;

  constructor(
    private readonly sessions: SessionService,
    config: ConfigService,
  ) {
    this.cookieName =
      config.get<string>('SESSION_COOKIE_NAME') ?? 'meinager_session';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token: unknown = request.cookies?.[this.cookieName];
    if (typeof token !== 'string' || !token)
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    const session = await this.sessions.findUserSession(token);
    if (!session)
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    (request as UserSessionRequest).userSession = session;
    return true;
  }
}
