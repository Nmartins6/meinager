import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganizationRole } from '../../generated/prisma/enums.js';
import type { AuthenticatedRequest } from '../session/session.types.js';
import { ORGANIZATION_ROLES_KEY } from './organization-roles.decorator.js';

@Injectable()
export class OrganizationRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!requiredRoles.includes(request.auth.organization.role)) {
      throw new ForbiddenException(
        'Você não tem permissão para realizar esta ação.',
      );
    }

    return true;
  }
}
