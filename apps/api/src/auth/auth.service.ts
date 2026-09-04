import { ConflictException, Injectable } from '@nestjs/common';
import { argon2id, hash } from 'argon2';
import { randomBytes } from 'node:crypto';
import { OrganizationRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const passwordHash = await hash(dto.password, {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            normalizedEmail,
            passwordHash,
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        const organization = await transaction.organization.create({
          data: {
            name: dto.organizationName,
            slug: this.createOrganizationSlug(dto.organizationName),
            document: dto.document ?? null,
            segment: dto.segment ?? null,
          },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        });

        await transaction.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: OrganizationRole.OWNER,
          },
        });

        await transaction.auditLog.create({
          data: {
            organizationId: organization.id,
            actorUserId: user.id,
            action: 'organization.created',
            entityType: 'organization',
            entityId: organization.id,
          },
        });

        return {
          user,
          organization: {
            ...organization,
            role: OrganizationRole.OWNER,
          },
        };
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('E-mail ou documento já cadastrado.');
      }

      throw error;
    }
  }

  private createOrganizationSlug(name: string): string {
    const baseSlug =
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'empresa';

    return `${baseSlug}-${randomBytes(4).toString('hex')}`;
  }

  private isUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
