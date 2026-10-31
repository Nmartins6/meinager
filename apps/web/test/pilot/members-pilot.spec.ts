import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, test, type BrowserContext } from '@playwright/test';

const apiRequire = createRequire(
  fileURLToPath(new URL('../../../api/package.json', import.meta.url)),
);
const { Client } = apiRequire('pg');

async function disposableDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  expect(process.env.PILOT_TEST_CONFIRM_DISPOSABLE).toBe('YES');
  expect(url.hostname).toBe('127.0.0.1');
  expect(url.pathname).toBe(`/meinager_pilot_${process.env.PILOT_TEST_RUN_ID}`);
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  const marker = await client.query(
    "SELECT pg_catalog.shobj_description(oid, 'pg_database') AS marker FROM pg_catalog.pg_database WHERE datname = current_database()",
  );
  expect(marker.rows[0].marker).toBe(process.env.PILOT_TEST_DB_MARKER);
  return client;
}

test('convites resistem a adulteração, expiração, revogação, corrida e falha de auditoria', async ({
  browser,
}) => {
  const runId = randomBytes(5).toString('hex');
  const api = `${process.env.PILOT_API_URL}/api`;
  const password = `Pilot-${runId}-Pass!`;
  const contexts: BrowserContext[] = [];
  const database = await disposableDatabase();
  async function context() {
    const result = await browser.newContext();
    contexts.push(result);
    return result;
  }
  async function register(current: BrowserContext, email: string) {
    const response = await current.request.post(`${api}/auth/register`, {
      data: { name: 'Pessoa fictícia', email, password, organizationName: `Empresa ${email}` },
    });
    expect(response.status()).toBe(201);
    return response.json();
  }
  async function invite(owner: BrowserContext, email: string, role = 'ADMIN') {
    const response = await owner.request.post(`${api}/organization/invitations`, {
      data: { email, role },
    });
    expect(response.status()).toBe(201);
    return response.json();
  }

  try {
    const owner = await context();
    const ownerAuth = await register(owner, `owner-${runId}@example.invalid`);
    const recipient = await context();
    const recipientEmail = `recipient-${runId}@example.invalid`;
    await register(recipient, recipientEmail);
    const outsider = await context();
    const outsiderAuth = await register(outsider, `outsider-${runId}@example.invalid`);

    const main = await invite(owner, recipientEmail);
    expect((await outsider.request.get(`${api}/auth/invitations/${main.token}`)).status()).toBe(
      200,
    );
    const beforeAcceptance = await database.query(
      'SELECT count(*)::int AS count FROM organization_members WHERE organization_id = $1 AND user_id = (SELECT id FROM users WHERE normalized_email = $2)',
      [ownerAuth.organization.id, recipientEmail],
    );
    expect(beforeAcceptance.rows[0].count).toBe(0);
    const listed = await owner.request.get(`${api}/organization/invitations`);
    expect(listed.status()).toBe(200);
    expect(JSON.stringify(await listed.json())).not.toContain(main.token);
    expect((await outsider.request.get(`${api}/organization/invitations`)).status()).toBe(200);
    expect(await (await outsider.request.get(`${api}/organization/invitations`)).json()).toEqual(
      [],
    );
    expect(
      (await outsider.request.delete(`${api}/organization/invitations/${main.id}`)).status(),
    ).toBe(404);
    expect(
      (await outsider.request.post(`${api}/auth/invitations/${main.token}/accept`)).status(),
    ).toBe(403);
    expect(
      (
        await outsider.request.post(`${api}/auth/organization`, {
          data: { organizationId: ownerAuth.organization.id },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await owner.request.post(`${api}/organization/invitations`, {
          data: { email: recipientEmail, role: 'OWNER' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await owner.request.post(`${api}/organization/invitations`, {
          data: { email: recipientEmail, role: 'ADMIN', organizationId: ownerAuth.organization.id },
        })
      ).status(),
    ).toBe(400);

    const [first, second] = await Promise.all([
      recipient.request.post(`${api}/auth/invitations/${main.token}/accept`, {
        data: { role: 'OWNER', organizationId: ownerAuth.organization.id },
      }),
      recipient.request.post(`${api}/auth/invitations/${main.token}/accept`),
    ]);
    expect([first.status(), second.status()].sort()).toEqual([200, 409]);
    const memberCount = await database.query(
      'SELECT count(*)::int AS count FROM organization_members WHERE organization_id = $1 AND user_id = (SELECT id FROM users WHERE normalized_email = $2)',
      [ownerAuth.organization.id, recipientEmail],
    );
    expect(memberCount.rows[0].count).toBe(1);
    const originalContext = await recipient.request.get(`${api}/auth/me`);
    const originalOrganizationId = (await originalContext.json()).organization.id;
    expect(originalOrganizationId).not.toBe(ownerAuth.organization.id);
    const foreignClientResponse = await recipient.request.post(`${api}/clients`, {
      data: { name: `Other organization ${runId}` },
    });
    expect(foreignClientResponse.status()).toBe(201);
    const foreignClient = await foreignClientResponse.json();
    const localClientResponse = await owner.request.post(`${api}/clients`, {
      data: { name: `Inviting organization ${runId}` },
    });
    expect(localClientResponse.status()).toBe(201);
    const localClient = await localClientResponse.json();
    const selectedA = await recipient.request.post(`${api}/auth/organization`, {
      data: { organizationId: ownerAuth.organization.id },
    });
    expect(selectedA.status()).toBe(200);
    expect((await selectedA.json()).contextVersion).toBe(1);
    const inA = await recipient.request.get(`${api}/clients`);
    expect((await inA.json()).data.map((item: { id: string }) => item.id)).toEqual([
      localClient.id,
    ]);
    expect((await recipient.request.get(`${api}/clients/${foreignClient.id}`)).status()).toBe(404);
    const selectedB = await recipient.request.post(`${api}/auth/organization`, {
      data: { organizationId: originalOrganizationId },
    });
    expect((await selectedB.json()).contextVersion).toBe(2);
    const backToA = await recipient.request.post(`${api}/auth/organization`, {
      data: { organizationId: ownerAuth.organization.id },
    });
    expect((await backToA.json()).contextVersion).toBe(3);
    const staleA = {
      'X-Organization-Context': ownerAuth.organization.id,
      'X-Organization-Context-Version': '1',
    };
    expect((await recipient.request.get(`${api}/clients`, { headers: staleA })).status()).toBe(409);
    expect(
      (
        await recipient.request.post(`${api}/clients`, {
          headers: staleA,
          data: { name: `Stale write ${runId}` },
        })
      ).status(),
    ).toBe(409);
    const currentA = await recipient.request.get(`${api}/clients`, {
      headers: { ...staleA, 'X-Organization-Context-Version': '3' },
    });
    expect(currentA.status()).toBe(200);
    expect((await currentA.json()).data.map((item: { id: string }) => item.id)).toEqual([
      localClient.id,
    ]);
    expect(
      (await recipient.request.post(`${api}/auth/invitations/${main.token}/accept`)).status(),
    ).toBe(409);
    const repeat = await invite(owner, recipientEmail);
    expect(
      (await recipient.request.post(`${api}/auth/invitations/${repeat.token}/accept`)).status(),
    ).toBe(409);

    const expiredEmail = recipientEmail.replace('recipient-', 'expired-');
    const expired = await invite(owner, expiredEmail);
    await database.query(
      "UPDATE organization_invitations SET created_at = now() - interval '3 days', expires_at = now() - interval '1 day' WHERE id = $1",
      [expired.id],
    );
    const expiredInfo = await owner.request.get(`${api}/auth/invitations/${expired.token}`);
    expect((await expiredInfo.json()).status).toBe('EXPIRED');
    const expiredRecipient = await context();
    await register(expiredRecipient, expiredEmail);
    expect(
      (
        await expiredRecipient.request.post(`${api}/auth/invitations/${expired.token}/accept`)
      ).status(),
    ).toBe(409);
    expect(
      (await owner.request.delete(`${api}/organization/invitations/${expired.id}`)).status(),
    ).toBe(404);

    const revokedEmail = recipientEmail.replace('recipient-', 'revoked-');
    const revoked = await invite(owner, revokedEmail);
    expect(
      (await owner.request.delete(`${api}/organization/invitations/${revoked.id}`)).status(),
    ).toBe(204);
    expect(
      (await (await owner.request.get(`${api}/auth/invitations/${revoked.token}`)).json()).status,
    ).toBe('REVOKED');
    const revokedRecipient = await context();
    await register(revokedRecipient, revokedEmail);
    expect(
      (
        await revokedRecipient.request.post(`${api}/auth/invitations/${revoked.token}/accept`)
      ).status(),
    ).toBe(409);

    const raceEmail = `race-${runId}@example.invalid`;
    const raceInvite = await invite(owner, raceEmail);
    const raceRecipient = await context();
    await register(raceRecipient, raceEmail);
    const [acceptRace, revokeRace] = await Promise.all([
      raceRecipient.request.post(`${api}/auth/invitations/${raceInvite.token}/accept`),
      owner.request.delete(`${api}/organization/invitations/${raceInvite.id}`),
    ]);
    expect(
      (acceptRace.status() === 200 && revokeRace.status() === 404) ||
        (acceptRace.status() === 409 && revokeRace.status() === 204),
    ).toBe(true);
    const raceState = await database.query(
      'SELECT accepted_at, revoked_at FROM organization_invitations WHERE id = $1',
      [raceInvite.id],
    );
    expect(Boolean(raceState.rows[0].accepted_at)).not.toBe(Boolean(raceState.rows[0].revoked_at));
    const raceMember = await database.query(
      'SELECT count(*)::int AS count FROM organization_members WHERE organization_id = $1 AND user_id = (SELECT id FROM users WHERE normalized_email = $2)',
      [ownerAuth.organization.id, raceEmail],
    );
    expect(raceMember.rows[0].count).toBe(acceptRace.status() === 200 ? 1 : 0);
    const invitationAudit = await database.query(
      "SELECT metadata::text AS metadata FROM audit_logs WHERE organization_id = $1 AND action LIKE 'organization.invitation.%'",
      [ownerAuth.organization.id],
    );
    expect(JSON.stringify(invitationAudit.rows)).not.toContain(main.token);
    expect(JSON.stringify(invitationAudit.rows)).not.toContain(raceInvite.token);

    const rollbackEmail = `rollback-${runId}@example.invalid`;
    const rollback = await invite(owner, rollbackEmail);
    const newcomer = await context();
    expect(
      (
        await newcomer.request.post(`${api}/auth/invitations/${rollback.token}/register`, {
          data: { name: 'Nova pessoa', email: rollbackEmail, password },
        })
      ).status(),
    ).toBe(201);
    await database.query(
      `CREATE FUNCTION pilot_fail_invitation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'organization.invitation.accepted' THEN RAISE EXCEPTION 'controlled audit failure'; END IF; RETURN NEW; END $$`,
    );
    await database.query(
      'CREATE TRIGGER pilot_fail_invitation_audit_trigger BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION pilot_fail_invitation_audit()',
    );
    try {
      expect(
        (await newcomer.request.post(`${api}/auth/invitations/${rollback.token}/accept`)).status(),
      ).toBe(500);
      const row = await database.query(
        'SELECT accepted_at FROM organization_invitations WHERE id = $1',
        [rollback.id],
      );
      expect(row.rows[0].accepted_at).toBeNull();
      const membership = await database.query(
        'SELECT count(*)::int AS count FROM organization_members WHERE organization_id = $1 AND user_id = (SELECT id FROM users WHERE normalized_email = $2)',
        [ownerAuth.organization.id, rollbackEmail],
      );
      expect(membership.rows[0].count).toBe(0);
    } finally {
      await database.query('DROP TRIGGER pilot_fail_invitation_audit_trigger ON audit_logs');
      await database.query('DROP FUNCTION pilot_fail_invitation_audit()');
    }

    // Existing sessions must observe role and membership changes on every request.
    await database.query(
      "UPDATE organization_members SET role = 'ADMIN' WHERE organization_id = $1 AND user_id = $2",
      [ownerAuth.organization.id, ownerAuth.user.id],
    );
    expect((await owner.request.get(`${api}/organization/invitations`)).status()).toBe(403);
    expect(
      (
        await owner.request.post(`${api}/organization/invitations`, {
          data: { email: `denied-${runId}@example.invalid`, role: 'ADMIN' },
        })
      ).status(),
    ).toBe(403);
    await database.query(
      "UPDATE organization_members SET role = 'OWNER' WHERE organization_id = $1 AND user_id = $2",
      [ownerAuth.organization.id, ownerAuth.user.id],
    );
    expect((await owner.request.get(`${api}/organization/invitations`)).status()).toBe(200);
    await database.query(
      'UPDATE organization_members SET is_active = false WHERE organization_id = $1 AND user_id = $2',
      [ownerAuth.organization.id, ownerAuth.user.id],
    );
    expect((await owner.request.get(`${api}/organization/invitations`)).status()).toBe(401);
    const inactiveSession = await owner.request.get(`${api}/auth/me`);
    expect((await inactiveSession.json()).organization).toBeNull();
    await database.query(
      "UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE user_id = $1",
      [outsiderAuth.user.id],
    );
    expect((await outsider.request.get(`${api}/auth/me`)).status()).toBe(401);
    expect((await outsider.request.get(`${api}/clients`)).status()).toBe(401);
    expect((await recipient.request.post(`${api}/auth/logout`)).status()).toBe(204);
    expect((await recipient.request.get(`${api}/auth/me`)).status()).toBe(401);
  } finally {
    await database.end();
    for (const item of contexts) await item.close();
  }
});
