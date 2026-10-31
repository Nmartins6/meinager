import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { OrganizationStatus } from '../../generated/prisma/enums.js';
import type { AuthenticatedSession } from './session.types.js';

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface PreparedSession {
  token: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
  contextVersion: number;
}

@Injectable()
export class SessionService {
  private readonly ttlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.ttlDays = Number(configService.get<string>('SESSION_TTL_DAYS') ?? 30);

    if (
      !Number.isInteger(this.ttlDays) ||
      this.ttlDays < 1 ||
      this.ttlDays > 365
    ) {
      throw new Error('SESSION_TTL_DAYS must be an integer between 1 and 365');
    }
  }

  prepare(metadata: SessionMetadata = {}): PreparedSession {
    const token = randomBytes(32).toString('base64url');

    return {
      token,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + this.ttlDays * 24 * 60 * 60 * 1000),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent?.slice(0, 500),
    };
  }

  async create(
    userId: string,
    metadata: SessionMetadata = {},
    activeOrganizationId: string | null = null,
  ): Promise<CreatedSession> {
    const session = this.prepare(metadata);

    await this.prisma.session.create({
      data: {
        userId,
        activeOrganizationId,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
    });

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      contextVersion: 0,
    };
  }

  async findUserSession(token: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
        user: {
          isActive: true,
        },
      },
      select: {
        id: true,
        activeOrganizationId: true,
        contextVersion: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return session;
  }

  async findAuthenticated(token: string): Promise<AuthenticatedSession | null> {
    const session = await this.findUserSession(token);
    if (!session?.activeOrganizationId) return null;

    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: session.activeOrganizationId,
        isActive: true,
        organization: {
          status: OrganizationStatus.ACTIVE,
        },
      },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    return {
      sessionId: session.id,
      contextVersion: session.contextVersion,
      user: session.user,
      organization: {
        ...membership.organization,
        role: membership.role,
      },
    };
  }

  async listOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        isActive: true,
        organization: { status: OrganizationStatus.ACTIVE },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        role: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
    return memberships.map(({ role, organization }) => ({
      ...organization,
      role,
    }));
  }

  async switchOrganization(
    sessionId: string,
    userId: string,
    organizationId: string,
  ) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        isActive: true,
        organization: { status: OrganizationStatus.ACTIVE },
      },
      select: {
        role: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!membership)
      throw new ForbiddenException('Organização indisponível para esta conta.');
    try {
      const session = await this.prisma.session.update({
        where: {
          id: sessionId,
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          activeOrganizationId: organizationId,
          contextVersion: { increment: 1 },
        },
        select: { contextVersion: true },
      });
      return {
        ...membership.organization,
        role: membership.role,
        contextVersion: session.contextVersion,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      )
        throw new ForbiddenException('Sessão indisponível.');
      throw error;
    }
  }

  async revokeById(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
