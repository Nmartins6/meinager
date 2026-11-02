import assert from 'node:assert/strict';
import { Client } from 'pg';

const suffix = process.env.PILOT_TEST_RUN_ID;
const url = new URL(process.env.DATABASE_URL);
assert.equal(process.env.PILOT_TEST_CONFIRM_DISPOSABLE, 'YES');
assert.match(suffix, /^[a-f0-9]{16}$/);
assert.equal(url.hostname, '127.0.0.1');
assert.equal(
  url.pathname,
  process.env.PILOT_TEST_RESTORED === 'YES'
    ? `/meinager_restore_${suffix}`
    : `/meinager_pilot_${suffix}`,
);
assert.equal(
  process.env.PILOT_TEST_DB_MARKER,
  `Meinager disposable pilot ${suffix}`,
);

const db = new Client({ connectionString: url.toString() });
await db.connect();
try {
  const result = await db.query(
    "SELECT pg_catalog.shobj_description(oid, 'pg_database') AS marker FROM pg_catalog.pg_database WHERE datname = current_database()",
  );
  assert.equal(result.rows[0]?.marker, process.env.PILOT_TEST_DB_MARKER);
} finally {
  await db.end();
}

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');

const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
configureApp(app);
app.use(`/__pilot_ready_${suffix}`, (_request, response) =>
  response.status(200).send(suffix),
);
await app.listen(Number(process.env.PORT), '127.0.0.1');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => void app.close().then(() => process.exit(0)));
}
