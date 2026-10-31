import { ConflictException, ForbiddenException } from '@nestjs/common';
import { InvitationsService } from './invitations.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { SessionService } from './session/session.service.js';

const organizationId = '72967066-9611-4ef6-b49f-e9c7c9178d83';
const userId = '24392cc5-a5d3-47f1-87b0-6a8a91318712';
const invitationId = '2ff843d2-735d-482d-9d66-a3286725d332';

function fixture() {
  const row = {
    id: invitationId,
    organizationId,
    normalizedEmail: 'carol@example.invalid',
    role: 'ADMIN' as const,
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: new Date(),
    acceptedAt: null,
    revokedAt: null,
    organization: {
      id: organizationId,
      name: 'Casa',
      slug: 'casa',
      status: 'ACTIVE',
    },
  };
  const tx = {
    organizationInvitation: {
      create: vi
        .fn()
        .mockImplementation(async ({ data }) => ({ ...row, ...data })),
      findUnique: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    organizationMember: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    user: { create: vi.fn() },
    session: { create: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback) => callback(tx)),
    organizationInvitation: {
      findUnique: vi.fn().mockResolvedValue(row),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const sessions = { prepare: vi.fn() };
  const service = new InvitationsService(
    prisma as unknown as PrismaService,
    sessions as unknown as SessionService,
  );
  return { service, tx, prisma, row };
}

describe('InvitationsService', () => {
  it('persists only a hash and audits creation without a token or link', async () => {
    const { service, tx } = fixture();
    const result = await service.create(organizationId, userId, {
      email: 'Carol@example.invalid',
      role: 'ADMIN',
    });
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = tx.organizationInvitation.create.mock.calls[0]![0].data;
    expect(stored.tokenHash).not.toBe(result.token);
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.normalizedEmail).toBe('carol@example.invalid');
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      47 * 60 * 60 * 1000,
    );
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(
      result.token,
    );
  });

  it('rejects an OWNER invitation before writing', async () => {
    const { service, prisma } = fixture();
    await expect(
      service.create(organizationId, userId, {
        email: 'x@example.invalid',
        role: 'OWNER',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects the wrong recipient without granting access', async () => {
    const { service, tx } = fixture();
    await expect(
      service.accept('a'.repeat(43), userId, 'other@example.invalid'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.organizationMember.create).not.toHaveBeenCalled();
  });

  it('atomically consumes an invitation, creates a member and audits acceptance', async () => {
    const { service, tx } = fixture();
    const result = await service.accept(
      'a'.repeat(43),
      userId,
      'carol@example.invalid',
    );
    expect(result.organization.role).toBe('ADMIN');
    expect(tx.organizationInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ acceptedAt: null, revokedAt: null }),
      }),
    );
    expect(tx.organizationMember.create).toHaveBeenCalledWith({
      data: { organizationId, userId, role: 'ADMIN' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it('rejects a replay or concurrent loser before creating another membership', async () => {
    const { service, tx } = fixture();
    tx.organizationInvitation.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.accept('a'.repeat(43), userId, 'carol@example.invalid'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.organizationMember.create).not.toHaveBeenCalled();
  });

  it('does not change an existing member role', async () => {
    const { service, tx } = fixture();
    tx.organizationMember.findUnique.mockResolvedValueOnce({ role: 'VIEWER' });
    await expect(
      service.accept('a'.repeat(43), userId, 'carol@example.invalid'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.organizationInvitation.updateMany).not.toHaveBeenCalled();
  });

  it('never includes a token in invitation listings', async () => {
    const { service, prisma, row } = fixture();
    prisma.organizationInvitation.findMany.mockResolvedValueOnce([row]);
    const result = await service.list(organizationId);
    expect(result).toEqual([
      expect.objectContaining({ email: row.normalizedEmail, role: 'ADMIN' }),
    ]);
    expect(result[0]).not.toHaveProperty('token');
    expect(result[0]).not.toHaveProperty('tokenHash');
  });
});
