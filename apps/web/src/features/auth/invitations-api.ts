import { z } from 'zod';
import { apiRequest, setOrganizationContext } from '@/lib/api';

const role = z.enum(['ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER']);
const invitation = z
  .object({
    id: z.string().uuid(),
    email: z.email(),
    role,
    expiresAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
    status: z.enum(['PENDING', 'EXPIRED', 'REVOKED', 'ACCEPTED']),
  })
  .strict();

const invitationInfo = z
  .object({
    email: z.email(),
    role,
    organizationName: z.string(),
    status: z.enum(['PENDING', 'EXPIRED', 'REVOKED', 'ACCEPTED', 'UNAVAILABLE']),
    expiresAt: z.iso.datetime(),
  })
  .strict();

const organization = z.object({ id: z.uuid(), name: z.string(), slug: z.string(), role }).strict();

export type Invitation = z.infer<typeof invitation>;
export type InvitationInfo = z.infer<typeof invitationInfo>;

export async function listInvitations(): Promise<Invitation[]> {
  const response = await apiRequest('/organization/invitations');
  return z.array(invitation).parse(await response.json());
}

export async function createInvitation(email: string, requestedRole: z.infer<typeof role>) {
  const response = await apiRequest('/organization/invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role: requestedRole }),
  });
  return invitation
    .extend({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
    .parse(await response.json());
}

export async function revokeInvitation(id: string) {
  await apiRequest(`/organization/invitations/${id}`, { method: 'DELETE' });
}

export async function inspectInvitation(token: string): Promise<InvitationInfo> {
  const response = await apiRequest(`/auth/invitations/${encodeURIComponent(token)}`);
  return invitationInfo.parse(await response.json());
}

export async function registerInvited(
  token: string,
  input: { name: string; email: string; password: string },
) {
  const response = await apiRequest(`/auth/invitations/${encodeURIComponent(token)}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const result = z
    .object({
      user: z.object({ id: z.uuid(), name: z.string(), email: z.email() }),
      organization: z.null(),
      organizations: z.array(z.never()),
      contextVersion: z.number().int().nonnegative().default(0),
    })
    .parse(await response.json());
  setOrganizationContext(null);
  return result;
}

export async function acceptInvitation(token: string) {
  const response = await apiRequest(`/auth/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
  });
  return z
    .object({ organization })
    .strict()
    .parse(await response.json());
}
