/* Runs pricing API E2E tests in owned, disposable PostgreSQL databases. */
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
apiRequire('dotenv').config({ path: path.join(root, '.env'), quiet: true });
const { Client } = apiRequire('pg');

assert.equal(
  process.env.PRICING_TEST_CONFIRM_DISPOSABLE,
  'YES',
  'Set PRICING_TEST_CONFIRM_DISPOSABLE=YES to create disposable databases.',
);
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required.');

const normalUrl = new URL(process.env.DATABASE_URL);
const normalDatabase = decodeURIComponent(normalUrl.pathname.slice(1));
const suffix = randomBytes(8).toString('hex');
const database = `pricing_configuration_e2e_${suffix}`;
const cleanupProbe = `pricing_configuration_e2e_cleanup_${suffix}`;
const ownership = `Meinager disposable pricing configuration ${suffix}`;
const owned = new Set();

function assertTarget(name) {
  assert.match(name, /^pricing_configuration_e2e(?:_cleanup)?_[a-f0-9]{16}$/);
  assert.notEqual(name, normalDatabase);
  assert.ok(
    !['', 'postgres', 'template0', 'template1', 'meinager'].includes(name),
  );
  return name;
}

function connection(name) {
  assertTarget(name);
  const url = new URL(normalUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

function run(command, args, environment = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...environment },
    encoding: 'utf8',
    timeout: 120000,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.replaceAll(
    connection(database),
    '[disposable database]',
  );
  process.stdout.write(output);
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed with status ${result.status}`,
  );
}

async function createOwned(admin, name) {
  assertTarget(name);
  const existing = await admin.query(
    'SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1',
    [name],
  );
  assert.equal(
    existing.rowCount,
    0,
    `Disposable database already exists: ${name}`,
  );
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.query(`COMMENT ON DATABASE "${name}" IS '${ownership}'`);
  owned.add(name);
  console.log(`CREATED ${name}`);
}

async function dropOwned(admin, name) {
  if (!owned.has(name)) return;
  const marker = await admin.query(
    `SELECT pg_catalog.shobj_description(oid, 'pg_database') AS marker
       FROM pg_catalog.pg_database
      WHERE datname = $1`,
    [name],
  );
  assert.equal(marker.rows[0]?.marker, ownership);
  await admin.query(
    `SELECT pg_catalog.pg_terminate_backend(pid)
       FROM pg_catalog.pg_stat_activity
      WHERE datname = $1 AND pid <> pg_catalog.pg_backend_pid()`,
    [name],
  );
  await admin.query(`DROP DATABASE "${assertTarget(name)}"`);
  owned.delete(name);
  const remaining = await admin.query(
    'SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1',
    [name],
  );
  assert.equal(remaining.rowCount, 0);
  console.log(`REMOVED ${name}`);
}

async function withDisposableDatabase(admin, name, callback) {
  await createOwned(admin, name);
  try {
    await callback();
  } finally {
    await dropOwned(admin, name);
  }
}

async function main() {
  run('pnpm', ['--filter', '@meinager/pricing-calculator', 'build']);

  const maintenanceUrl = new URL(normalUrl);
  maintenanceUrl.pathname = '/postgres';
  const admin = new Client({
    connectionString: maintenanceUrl.toString(),
    connectionTimeoutMillis: 5000,
  });
  await admin.connect();

  try {
    let cleanupFailureObserved = false;
    try {
      await withDisposableDatabase(admin, cleanupProbe, async () => {
        throw new Error('intentional cleanup verification');
      });
    } catch (error) {
      assert.match(error.message, /intentional cleanup verification/);
      cleanupFailureObserved = true;
    }
    assert.equal(cleanupFailureObserved, true);
    console.log('PASS disposable database is removed after an error');

    await withDisposableDatabase(admin, database, async () => {
      const databaseUrl = connection(database);
      run(
        'pnpm',
        ['--filter', '@meinager/api', 'exec', 'prisma', 'migrate', 'deploy'],
        { DATABASE_URL: databaseUrl },
      );
      run(
        'pnpm',
        [
          '--filter',
          '@meinager/api',
          'exec',
          'vitest',
          'run',
          '--config',
          './vitest.config.e2e.ts',
          '--maxWorkers',
          '2',
          'test/pricing-configuration.e2e-spec.ts',
          'test/pricing-profiles.e2e-spec.ts',
          'test/pricing-compositions.e2e-spec.ts',
          'test/pricing-simulations.e2e-spec.ts',
          'test/pricing-versions.e2e-spec.ts',
          'test/pricing-adoptions.e2e-spec.ts',
          'test/products.e2e-spec.ts',
          'test/quotes.e2e-spec.ts',
          'test/orders.e2e-spec.ts',
        ],
        {
          DATABASE_URL: databaseUrl,
          PRICING_CONFIGURATION_E2E_DISPOSABLE: 'YES',
          PRICING_CONFIGURATION_E2E_DATABASE: database,
          PRICING_CONFIGURATION_E2E_NORMAL_DATABASE: normalDatabase,
        },
      );
    });
  } finally {
    for (const name of owned) await dropOwned(admin, name);
    await admin.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
