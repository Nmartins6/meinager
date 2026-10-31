import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { argon2id, hash } from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import {
  OrganizationRole,
  OrganizationStatus,
} from '../generated/prisma/enums.js';
import type {
  CreateInvitationDto,
  RegisterInvitedDto,
} from './dto/invitation.dto.js';
import {
  SessionService,
  type SessionMetadata,
} from './session/session.service.js';

const ttlMs = 48 * 60 * 60 * 1000;
const passwordHashOptions = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private status(invite: {
    acceptedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
  }) {
    if (invite.acceptedAt) return 'ACCEPTED';
    if (invite.revokedAt) return 'REVOKED';
    if (invite.expiresAt <= new Date()) return 'EXPIRED';
    return 'PENDING';
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateInvitationDto,
  ) {
    if (dto.role === OrganizationRole.OWNER)
      throw new ForbiddenException('Não é possível convidar um proprietário.');
    const token = randomBytes(32).toString('base64url');
    const invite = await this.prisma.$transaction(async (tx) => {
      const row = await tx.organizationInvitation.create({
        data: {
          id: randomUUID(),
          organizationId,
          normalizedEmail: dto.email.trim().toLowerCase(),
          role: dto.role,
          tokenHash: this.tokenHash(token),
          createdByUserId: actorUserId,
          expiresAt: new Date(Date.now() + ttlMs),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'organization.invitation.created',
          entityType: 'organization_invitation',
          entityId: row.id,
          metadata: { role: row.role },
        },
      });
      return row;
    });
    return {
      id: invite.id,
      email: invite.normalizedEmail,
      role: invite.role,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      status: 'PENDING',
      token,
    };
  }

  async list(organizationId: string) {
    const rows = await this.prisma.organizationInvitation.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        normalizedEmail: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        acceptedAt: true,
        revokedAt: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.normalizedEmail,
      role: row.role,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      status: this.status(row),
    }));
  }

  async revoke(organizationId: string, actorUserId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.organizationInvitation.updateMany({
        where: {
          id,
          organizationId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });
      if (result.count !== 1)
        throw new NotFoundException('Convite pendente não encontrado.');
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'organization.invitation.revoked',
          entityType: 'organization_invitation',
          entityId: id,
        },
      });
    });
  }

  async inspect(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new NotFoundException('Convite inválido.');
    const row = await this.prisma.organizationInvitation.findUnique({
      where: { tokenHash: this.tokenHash(token) },
      select: {
        id: true,
        normalizedEmail: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        organization: { select: { name: true, status: true } },
      },
    });
    if (!row) throw new NotFoundException('Convite inválido.');
    return {
      email: row.normalizedEmail,
      role: row.role,
      organizationName: row.organization.name,
      status:
        row.organization.status === OrganizationStatus.ACTIVE
          ? this.status(row)
          : 'UNAVAILABLE',
      expiresAt: row.expiresAt,
    };
  }

  async register(
    token: string,
    dto: RegisterInvitedDto,
    metadata: SessionMetadata,
  ) {
    const invite = await this.inspect(token);
    if (invite.status !== 'PENDING')
      throw new ConflictException('Convite indisponível.');
    if (invite.email !== dto.email.trim().toLowerCase())
      throw new ForbiddenException('Este convite pertence a outro e-mail.');
    const passwordHash = await hash(dto.password, passwordHashOptions);
    const session = this.sessions.prepare(metadata);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            normalizedEmail: dto.email.toLowerCase(),
            passwordHash,
          },
          select: { id: true, name: true, email: true },
        });
        await tx.session.create({
          data: {
            userId: created.id,
            activeOrganizationId: null,
            tokenHash: session.tokenHash,
            expiresAt: session.expiresAt,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          },
        });
        return created;
      });
      return {
        user,
        organization: null,
        organizations: [],
        session: {
          token: session.token,
          expiresAt: session.expiresAt,
          contextVersion: 0,
        },
      };
    } catch (error) {
      if (this.isUnique(error))
        throw new ConflictException(
          'E-mail já cadastrado. Entre na conta existente.',
        );
      throw error;
    }
  }

  async accept(token: string, userId: string, userEmail: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new NotFoundException('Convite inválido.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invite = await tx.organizationInvitation.findUnique({
          where: { tokenHash: this.tokenHash(token) },
          select: {
            id: true,
            organizationId: true,
            normalizedEmail: true,
            role: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
            organization: {
              select: { id: true, name: true, slug: true, status: true },
            },
          },
        });
        if (!invite) throw new NotFoundException('Convite inválido.');
        if (invite.normalizedEmail !== userEmail.toLowerCase())
          throw new ForbiddenException('Este convite pertence a outro e-mail.');
        if (
          invite.acceptedAt ||
          invite.revokedAt ||
          invite.expiresAt <= new Date() ||
          invite.organization.status !== OrganizationStatus.ACTIVE
        ) {
          throw new ConflictException('Convite indisponível.');
        }
        const existing = await tx.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: invite.organizationId,
              userId,
            },
          },
        });
        if (existing)
          throw new ConflictException(
            'A conta já pertence a esta organização.',
          );
        const result = await tx.organizationInvitation.updateMany({
          where: {
            id: invite.id,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { acceptedAt: new Date(), acceptedByUserId: userId },
        });
        if (result.count !== 1)
          throw new ConflictException('Convite indisponível.');
        await tx.organizationMember.create({
          data: {
            organizationId: invite.organizationId,
            userId,
            role: invite.role,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: invite.organizationId,
            actorUserId: userId,
            action: 'organization.invitation.accepted',
            entityType: 'organization_invitation',
            entityId: invite.id,
            metadata: { role: invite.role },
          },
        });
        return {
          organization: {
            id: invite.organization.id,
            name: invite.organization.name,
            slug: invite.organization.slug,
            role: invite.role,
          },
        };
      });
    } catch (error) {
      if (this.isUnique(error))
        throw new ConflictException('A conta já pertence a esta organização.');
      throw error;
    }
  }

  private isUnique(error: unknown): error is { code: 'P2002' } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
