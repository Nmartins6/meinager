/* Test-only role fixtures. DATABASE_URL must be the runner-owned pilot database. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { hash, argon2id } = require('argon2');

assert.equal(process.env.PILOT_TEST_CONFIRM_DISPOSABLE, 'YES');
const suffix = process.env.PILOT_TEST_RUN_ID;
const url = new URL(process.env.DATABASE_URL);
assert.match(suffix, /^[a-f0-9]{16}$/);
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.pathname, `/meinager_pilot_${suffix}`);
assert.equal(
  process.env.PILOT_TEST_DB_MARKER,
  `Meinager disposable pilot ${suffix}`,
);

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const { ownerEmail, password, suffix } = JSON.parse(
    Buffer.concat(chunks).toString(),
  );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const db = await client.query(
      "SELECT pg_catalog.shobj_description(oid, 'pg_database') AS marker FROM pg_catalog.pg_database WHERE datname = current_database()",
    );
    assert.equal(db.rows[0]?.marker, process.env.PILOT_TEST_DB_MARKER);
    const owner = await client.query(
      `SELECT m.organization_id FROM users u JOIN organization_members m ON m.user_id = u.id
       WHERE u.normalized_email = $1 AND m.role = 'OWNER'`,
      [ownerEmail.toLowerCase()],
    );
    assert.equal(owner.rowCount, 1);
    const passwordHash = await hash(password, {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    for (const role of ['FINANCE', 'VIEWER']) {
      const userId = randomUUID();
      const email = `${role.toLowerCase()}-${suffix}@example.invalid`;
      await client.query(
        `INSERT INTO users (id, name, email, normalized_email, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $3, $4, now(), now())`,
        [userId, `Piloto Fictício ${role}`, email, passwordHash],
      );
      await client.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, now(), now())`,
        [randomUUID(), owner.rows[0].organization_id, userId, role],
      );
    }
    process.stdout.write('ROLE_FIXTURES_READY\n');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`ROLE_FIXTURES_FAILED ${error.code ?? 'unknown'}`);
  process.exitCode = 1;
});
