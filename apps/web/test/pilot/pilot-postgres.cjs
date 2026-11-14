/* Owns a disposable PostgreSQL database, localhost servers and browser test. */
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '../../../..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const { Client } = apiRequire('pg');

assert.equal(process.env.PILOT_TEST_CONFIRM_DISPOSABLE, 'YES');
const suffix = randomBytes(8).toString('hex');
const container = `meinager_pilot_pg_${suffix}`;
const postgresPassword = randomBytes(24).toString('hex');
const database = `meinager_pilot_${suffix}`;
const cleanupProbe = `meinager_pilot_cleanup_${suffix}`;
const restoredDatabase = `meinager_restore_${suffix}`;
const marker = `Meinager disposable pilot ${suffix}`;
const owned = new Set();
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'meinager-pilot-evidence-'));
const children = [];
let serverUrl;
let containerCreationAttempted = false;
let interruptedBy;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interruptedBy = signal;
  });
}

function checkInterruption() {
  if (interruptedBy) throw new Error(`Pilot interrupted by ${interruptedBy}`);
}

function isolatedEnvironment(overrides = {}) {
  const environment = { ...process.env };
  for (const key of ['DATABASE_URL', 'DIRECT_URL', 'SHADOW_DATABASE_URL', 'VITE_API_URL']) {
    delete environment[key];
  }
  return { ...environment, ...overrides };
}

function disposableUrl(name) {
  assert.match(name, /^(?:meinager_pilot(?:_cleanup)?|meinager_restore)_[a-f0-9]{16}$/);
  assert.ok(!['postgres', 'template0', 'template1', 'meinager'].includes(name));
  assert.ok(serverUrl, 'Pilot PostgreSQL is not started.');
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

function safeOutput(value) {
  const withoutServerUrl = serverUrl
    ? value.replaceAll(serverUrl.toString(), '[pilot server URL]')
    : value;
  return withoutServerUrl
    .replaceAll(postgresPassword, '[pilot password]')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[database URL]')
    .replace(/Pilot-[a-f0-9]+-Pass!/g, '[fictitious test password]')
    .replace(/(authorization|set-cookie|cookie):[^\r\n]+/gi, '$1: [redacted]')
    .replace(/"(password|secret|token|cookie|authorization)"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"')
    .replace(/(password|secret|token|cookie)=\S+/gi, '$1=[redacted]');
}

async function startPostgres() {
  const port = await freePort();
  serverUrl = new URL(`postgresql://pilot_test:${postgresPassword}@127.0.0.1:${port}/postgres`);
  containerCreationAttempted = true;
  run(
    'docker',
    [
      'run',
      '--detach',
      '--rm',
      '--name',
      container,
      '--label',
      `meinager.pilot.owner=${suffix}`,
      '--env',
      'POSTGRES_USER=pilot_test',
      '--env',
      'POSTGRES_DB=postgres',
      '--env',
      'POSTGRES_PASSWORD',
      '--publish',
      `127.0.0.1:${port}:5432`,
      'postgres:18-alpine',
    ],
    { POSTGRES_PASSWORD: postgresPassword },
  );
  const binding = spawnSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' });
  assert.equal(binding.status, 0);
  assert.equal(binding.stdout.trim(), `127.0.0.1:${port}`);
  console.log(`POSTGRES_LOOPBACK_ONLY ${container} 127.0.0.1:${port}`);
}

async function connectAdmin() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const client = new Client({
      connectionString: serverUrl.toString(),
      connectionTimeoutMillis: 1000,
    });
    try {
      await client.connect();
      return client;
    } catch {
      await client.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Disposable PostgreSQL did not become ready.');
}

async function stopPostgres() {
  if (!containerCreationAttempted) return;
  const ownership = spawnSync(
    'docker',
    ['inspect', '--format', '{{ index .Config.Labels "meinager.pilot.owner" }}', container],
    { encoding: 'utf8' },
  );
  if (ownership.status !== 0) {
    // docker run may fail before creating a container. Never stop a foreign one.
    const absent = spawnSync('docker', ['inspect', container], { encoding: 'utf8' });
    assert.notEqual(absent.status, 0, `Container identity cannot be verified: ${container}`);
    return;
  }
  assert.equal(ownership.stdout.trim(), suffix);
  const result = spawnSync('docker', ['stop', container], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0);
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const remaining = spawnSync('docker', ['inspect', container], { encoding: 'utf8' });
    if (remaining.status !== 0) {
      console.log(`POSTGRES_REMOVED ${container}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Disposable PostgreSQL was not removed: ${container}`);
}

function sanitizeArtifacts(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) sanitizeArtifacts(target);
    else if (/\.(?:md|log|json)$/.test(entry.name)) {
      const content = fs.readFileSync(target, 'utf8');
      fs.writeFileSync(target, safeOutput(content));
    }
  }
}

function run(command, args, environment = {}) {
  checkInterruption();
  const result = spawnSync(command, args, {
    cwd: root,
    env: isolatedEnvironment(environment),
    encoding: 'utf8',
    timeout: 180000,
  });
  const output = safeOutput(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  process.stdout.write(output);
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed (${result.status})`);
  checkInterruption();
}

async function createOwned(admin, name) {
  disposableUrl(name);
  const existing = await admin.query('SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1', [
    name,
  ]);
  assert.equal(existing.rowCount, 0);
  await admin.query(`CREATE DATABASE "${name}"`);
  owned.add(name);
  try {
    await admin.query(`COMMENT ON DATABASE "${name}" IS '${marker}'`);
  } catch (error) {
    await admin.query(`DROP DATABASE "${name}"`);
    owned.delete(name);
    throw error;
  }
  console.log(`CREATED ${name}`);
}

async function verifyLegacySessionMigration() {
  const client = new Client({ connectionString: disposableUrl(cleanupProbe) });
  await client.connect();
  try {
    const migrationDirectory = path.join(root, 'apps/api/prisma/migrations');
    const legacyMigrations = fs
      .readdirSync(migrationDirectory, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && entry.name < '20261031150000_add_organization_invitations',
      )
      .map((entry) => entry.name)
      .sort();
    assert.equal(legacyMigrations.length, 16);
    for (const name of legacyMigrations) {
      await client.query(
        fs.readFileSync(path.join(migrationDirectory, name, 'migration.sql'), 'utf8'),
      );
    }
    const userId = randomUUID();
    const organizationId = randomUUID();
    const sessionId = randomUUID();
    const revokedSessionId = randomUUID();
    const auditId = randomUUID();
    await client.query(
      "INSERT INTO users (id, name, email, normalized_email, password_hash, updated_at) VALUES ($1, 'Legacy user', 'legacy@example.invalid', 'legacy@example.invalid', 'dummy-hash', now())",
      [userId],
    );
    await client.query(
      "INSERT INTO organizations (id, name, slug, updated_at) VALUES ($1, 'Legacy organization', 'legacy-organization', now())",
      [organizationId],
    );
    await client.query(
      "INSERT INTO organization_members (id, organization_id, user_id, role, updated_at) VALUES ($3, $1, $2, 'OWNER', now())",
      [organizationId, userId, randomUUID()],
    );
    await client.query(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, 'legacy-active-token-hash', now() + interval '1 day')",
      [sessionId, userId],
    );
    await client.query(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at, revoked_at) VALUES ($1, $2, 'legacy-revoked-token-hash', now() + interval '1 day', now() - interval '1 day')",
      [revokedSessionId, userId],
    );
    await client.query(
      "INSERT INTO audit_logs (id, organization_id, actor_user_id, action, entity_type, entity_id) VALUES ($3, $1, $2, 'legacy.event', 'organization', $4)",
      [organizationId, userId, auditId, organizationId],
    );
    const migration = fs.readFileSync(
      path.join(migrationDirectory, '20261031150000_add_organization_invitations/migration.sql'),
      'utf8',
    );
    await client.query(migration);
    const oldSession = await client.query(
      'SELECT revoked_at, active_organization_id, context_version FROM sessions WHERE id = $1',
      [sessionId],
    );
    assert.ok(oldSession.rows[0]?.revoked_at);
    assert.equal(oldSession.rows[0]?.active_organization_id, null);
    assert.equal(oldSession.rows[0]?.context_version, 0);
    const preserved = await client.query(
      'SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM organizations) AS organizations, (SELECT count(*) FROM organization_members) AS members, (SELECT count(*) FROM audit_logs WHERE id = $1) AS audit, (SELECT revoked_at FROM sessions WHERE id = $2) AS prior_revocation',
      [auditId, revokedSessionId],
    );
    assert.equal(Number(preserved.rows[0].users), 1);
    assert.equal(Number(preserved.rows[0].organizations), 1);
    assert.equal(Number(preserved.rows[0].members), 1);
    assert.equal(Number(preserved.rows[0].audit), 1);
    assert.ok(preserved.rows[0].prior_revocation);
    console.log('LEGACY_SESSION_REVOKED_IN_POPULATED_BASELINE_MIGRATION_PROBE');

    const clientId = randomUUID();
    const productId = randomUUID();
    const workflowId = randomUUID();
    const stageId = randomUUID();
    const quoteId = randomUUID();
    const quoteItemId = randomUUID();
    const orderId = randomUUID();
    const orderItemId = randomUUID();
    await client.query(
      "INSERT INTO clients (id, organization_id, name, updated_at) VALUES ($1, $2, 'Legacy client', now())",
      [clientId, organizationId],
    );
    await client.query(
      "INSERT INTO products (id, organization_id, name, normalized_name, unit, sale_price, updated_at) VALUES ($1, $2, 'Legacy product', 'legacy product', 'UN', 20, now())",
      [productId, organizationId],
    );
    await client.query(
      "INSERT INTO order_workflows (id, organization_id, name, normalized_name, is_default, updated_at) VALUES ($1, $2, 'Legacy workflow', 'legacy workflow', true, now())",
      [workflowId, organizationId],
    );
    await client.query(
      "INSERT INTO order_workflow_stages (id, organization_id, workflow_id, name, position, category, updated_at) VALUES ($1, $2, $3, 'Pending', 1, 'PENDING', now())",
      [stageId, organizationId, workflowId],
    );
    await client.query(
      'INSERT INTO financial_quotes (id, organization_id, client_id, number, subtotal, discount, total, updated_at) VALUES ($1, $2, $3, 1, 20, 0, 20, now())',
      [quoteId, organizationId, clientId],
    );
    await client.query(
      "INSERT INTO financial_quote_items (id, organization_id, quote_id, product_id, position, description, unit, quantity, unit_price, total, updated_at) VALUES ($1, $2, $3, $4, 1, 'Legacy product', 'UN', 1, 20, 20, now())",
      [quoteItemId, organizationId, quoteId, productId],
    );
    await client.query(
      'INSERT INTO orders (id, organization_id, quote_id, client_id, workflow_id, current_stage_id, number, subtotal, discount, total, updated_at) VALUES ($1, $2, $3, $4, $5, $6, 1, 20, 0, 20, now())',
      [orderId, organizationId, quoteId, clientId, workflowId, stageId],
    );
    await client.query(
      "INSERT INTO order_items (id, organization_id, order_id, product_id, position, description, unit, quantity, unit_price, total, updated_at) VALUES ($1, $2, $3, $4, 1, 'Legacy product', 'UN', 1, 20, 20, now())",
      [orderItemId, organizationId, orderId, productId],
    );
    await client.query(
      fs.readFileSync(
        path.join(migrationDirectory, '20261101100000_add_commercial_price_origin/migration.sql'),
        'utf8',
      ),
    );
    const legacyDocuments = await client.query(
      'SELECT (SELECT price_origin FROM financial_quote_items WHERE id = $1) AS quote_origin, (SELECT pricing_version_id FROM financial_quote_items WHERE id = $1) AS quote_version, (SELECT price_origin FROM order_items WHERE id = $2) AS order_origin, (SELECT pricing_version_id FROM order_items WHERE id = $2) AS order_version, (SELECT unit_price FROM financial_quote_items WHERE id = $1) AS quote_price, (SELECT unit_price FROM order_items WHERE id = $2) AS order_price',
      [quoteItemId, orderItemId],
    );
    assert.deepEqual(legacyDocuments.rows[0], {
      quote_origin: null,
      quote_version: null,
      order_origin: null,
      order_version: null,
      quote_price: '20.00',
      order_price: '20.00',
    });
    console.log('LEGACY_QUOTE_AND_ORDER_PRESERVED_IN_POPULATED_MIGRATION_PROBE');
  } finally {
    await client.end();
  }
}

async function dropOwned(admin, name) {
  if (!owned.has(name)) return;
  const row = await admin.query(
    `SELECT pg_catalog.shobj_description(oid, 'pg_database') AS marker FROM pg_catalog.pg_database WHERE datname = $1`,
    [name],
  );
  assert.equal(row.rows[0]?.marker, marker);
  await admin.query(
    `SELECT pg_catalog.pg_terminate_backend(pid) FROM pg_catalog.pg_stat_activity WHERE datname = $1 AND pid <> pg_catalog.pg_backend_pid()`,
    [name],
  );
  await admin.query(`DROP DATABASE "${name}"`);
  owned.delete(name);
  assert.equal(
    (await admin.query('SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1', [name])).rowCount,
    0,
  );
  console.log(`REMOVED ${name}`);
}

async function verifyBackupAndRestore(admin, sourceUrl, environment, webUrl) {
  const archive = path.join(artifacts, `pilot-${suffix}.dump`);
  const source = new Client({ connectionString: sourceUrl });
  await source.connect();
  let original;
  try {
    const tables = [
      'users',
      'sessions',
      'organizations',
      'organization_members',
      'audit_logs',
      'products',
      'organization_pricing_configurations',
      'organization_pricing_configuration_revisions',
      'pricing_sales_profiles',
      'pricing_sales_profile_revisions',
      'product_pricing_compositions',
      'pricing_components',
      'pricing_calculation_versions',
      'pricing_version_components',
      'pricing_version_deductions',
      'pricing_price_adoptions',
      'financial_quotes',
      'financial_quote_items',
      'orders',
      'order_items',
      '_prisma_migrations',
    ];
    original = {};
    for (const table of tables) {
      original[table] = (
        await source.query(`SELECT count(*)::int AS total FROM ${table}`)
      ).rows[0].total;
    }
    assert.ok(original.pricing_calculation_versions > 0);
    assert.ok(original.financial_quotes > 0);
    assert.ok(original.orders > 0);
    assert.equal(original._prisma_migrations, 18);
    const ownerOrganization = await source.query(
      `SELECT m.organization_id FROM organization_members m
       JOIN users u ON u.id = m.user_id
       WHERE u.name = 'Nicolas Piloto Fictício' LIMIT 1`,
    );
    assert.equal(ownerOrganization.rowCount, 1);
    for (const table of ['stock_movements', 'financial_entries']) {
      const count = await source.query(
        `SELECT count(*)::int AS total FROM ${table} WHERE organization_id = $1`,
        [ownerOrganization.rows[0].organization_id],
      );
      assert.equal(count.rows[0].total, 0, `no automatic ${table} for pricing/quote/order flow`);
    }
    console.log('NO_AUTOMATIC_STOCK_OR_FINANCIAL_ENTRY_IN_PILOT_FLOW');
  } finally {
    await source.end();
  }

  run('bash', ['tools/pilot-backup.sh', container, database, archive], {
    MEINAGER_BACKUP_CONFIRM_DATABASE: database,
  });
  try {
    const existingArchive = spawnSync(
      'bash',
      ['tools/pilot-backup.sh', container, database, archive],
      {
        cwd: root,
        env: isolatedEnvironment({ MEINAGER_BACKUP_CONFIRM_DATABASE: database }),
        encoding: 'utf8',
      },
    );
    assert.equal(existingArchive.status, 2, 'backup refuses an existing archive');
    const withoutConfirmation = spawnSync(
      'bash',
      ['tools/pilot-restore.sh', container, archive, restoredDatabase],
      { cwd: root, env: isolatedEnvironment(), encoding: 'utf8' },
    );
    assert.equal(
      withoutConfirmation.status,
      2,
      'restore requires an exact destination confirmation',
    );
    run('bash', ['tools/pilot-restore.sh', container, archive, restoredDatabase], {
      MEINAGER_RESTORE_CONFIRM_DESTINATION: restoredDatabase,
    });
    const existingDestination = spawnSync(
      'bash',
      ['tools/pilot-restore.sh', container, archive, restoredDatabase],
      {
        cwd: root,
        env: isolatedEnvironment({ MEINAGER_RESTORE_CONFIRM_DESTINATION: restoredDatabase }),
        encoding: 'utf8',
      },
    );
    assert.equal(existingDestination.status, 2, 'restore refuses an existing destination');
    await admin.query(`COMMENT ON DATABASE "${restoredDatabase}" IS '${marker}'`);
    owned.add(restoredDatabase);
    const restored = new Client({ connectionString: disposableUrl(restoredDatabase) });
    await restored.connect();
    let ownerEmail;
    let productId;
    try {
      for (const [table, total] of Object.entries(original)) {
        assert.equal(
          (await restored.query(`SELECT count(*)::int AS total FROM ${table}`)).rows[0].total,
          total,
          `restored ${table}`,
        );
      }
      const relationships = await restored.query(`
        SELECT q.id, qi.pricing_version_id, oi.pricing_version_id AS order_version_id,
               v.product_id, a.version_id AS adopted_version_id
        FROM financial_quotes q
        JOIN financial_quote_items qi ON qi.quote_id = q.id
        JOIN orders o ON o.quote_id = q.id
        JOIN order_items oi ON oi.order_id = o.id AND oi.position = qi.position
        JOIN pricing_calculation_versions v ON v.id = qi.pricing_version_id
        LEFT JOIN pricing_price_adoptions a ON a.product_id = v.product_id AND a.version_id = v.id
        WHERE qi.pricing_version_id IS NOT NULL
      `);
      assert.ok(relationships.rows.length > 0, 'restored versioned quote and order relationship');
      assert.ok(
        relationships.rows.every(
          (row) =>
            row.pricing_version_id === row.order_version_id && row.adopted_version_id !== null,
        ),
      );
      productId = relationships.rows[0].product_id;
      const owner = await restored.query(
        "SELECT email FROM users WHERE name = 'Nicolas Piloto Fictício' ORDER BY created_at DESC LIMIT 1",
      );
      ownerEmail = owner.rows[0]?.email;
      assert.match(ownerEmail, /^nicolas-[a-f0-9]{10}@example\.invalid$/);
    } finally {
      await restored.end();
    }

    const restoredPort = await freePort();
    const restoredApiUrl = `http://127.0.0.1:${restoredPort}`;
    const restoredApi = start(
      'node',
      ['apps/api/test/pilot-server.mjs'],
      {
        ...environment,
        DATABASE_URL: disposableUrl(restoredDatabase),
        PILOT_TEST_RESTORED: 'YES',
        PORT: String(restoredPort),
        WEB_ORIGIN: webUrl,
      },
      'restored-api',
    );
    await waitFor(`${restoredApiUrl}/__pilot_ready_${suffix}`, restoredApi);
    const fixtureId = ownerEmail.slice('nicolas-'.length, -'@example.invalid'.length);
    const login = await fetch(`${restoredApiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: `Pilot-${fixtureId}-Pass!` }),
    });
    assert.equal(login.status, 200, 'application login against restored database');
    const session = await login.json();
    const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
    assert.ok(cookie);
    const product = await fetch(`${restoredApiUrl}/api/products/${productId}`, {
      headers: {
        cookie,
        'X-Organization-Context': session.organization.id,
        'X-Organization-Context-Version': String(session.contextVersion),
      },
    });
    assert.equal(product.status, 200, 'application reads restored product');
    const versions = await fetch(`${restoredApiUrl}/api/pricing/products/${productId}/versions`, {
      headers: {
        cookie,
        'X-Organization-Context': session.organization.id,
        'X-Organization-Context-Version': String(session.contextVersion),
      },
    });
    assert.equal(versions.status, 200, 'application reads restored pricing history');
    assert.ok((await versions.json()).data.length > 0);
    console.log(
      `RESTORE_VERIFIED ${restoredDatabase} migrations=${original._prisma_migrations} versions=${original.pricing_calculation_versions} quotes=${original.financial_quotes} orders=${original.orders} application=OK`,
    );
  } finally {
    fs.rmSync(archive, { force: true });
  }
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(0, '127.0.0.1', resolve),
  );
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function start(command, args, env, label) {
  checkInterruption();
  const child = spawn(command, args, {
    cwd: root,
    env: isolatedEnvironment(env),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  const stream = fs.createWriteStream(path.join(artifacts, `${label}.log`));
  for (const output of [child.stdout, child.stderr]) {
    output.on('data', (chunk) => stream.write(safeOutput(String(chunk))));
  }
  return child;
}

async function waitFor(url, child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    checkInterruption();
    if (child.exitCode !== null) throw new Error(`Server exited before readiness: ${url}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      /* Server is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server readiness timed out: ${url}`);
}

async function stopChildren() {
  const errors = [];
  for (const child of children.splice(0).reverse()) {
    try {
      if (child.exitCode === null) {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch (error) {
          if (error.code !== 'ESRCH') throw error;
        }
        await Promise.race([
          new Promise((resolve) => child.once('exit', resolve)),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
        if (child.exitCode === null) {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch (error) {
            if (error.code !== 'ESRCH') throw error;
          }
        }
      }
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, 'Failed to stop pilot processes');
}

async function runBrowserRound(environment, grep, label) {
  const apiPort = await freePort();
  const webPort = await freePort();
  assert.notEqual(apiPort, webPort);
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const webUrl = `http://127.0.0.1:${webPort}`;
  try {
    const api = start(
      'node',
      ['apps/api/test/pilot-server.mjs'],
      { ...environment, PORT: String(apiPort), WEB_ORIGIN: webUrl },
      `api-${label}`,
    );
    await waitFor(`${apiUrl}/__pilot_ready_${suffix}`, api);
    const compiledWeb = label === 'guided-setup';
    if (compiledWeb) {
      run('pnpm', ['--filter', '@meinager/web', 'build'], {
        ...environment,
        NODE_ENV: 'production',
        VITE_API_URL: `${apiUrl}/api`,
      });
    }
    const web = start(
      'pnpm',
      [
        '--filter',
        '@meinager/web',
        'exec',
        'vite',
        ...(compiledWeb ? ['preview'] : []),
        '--host',
        '127.0.0.1',
        '--port',
        String(webPort),
        '--strictPort',
      ],
      { ...environment, VITE_API_URL: `${apiUrl}/api` },
      `web-${label}`,
    );
    await waitFor(webUrl, web);
    console.log(`PILOT_URLS ${label} api=${apiUrl} web=${webUrl}`);
    run(
      'pnpm',
      [
        '--filter',
        '@meinager/web',
        'exec',
        'playwright',
        'test',
        '--config',
        'playwright.pilot.config.ts',
        '--grep',
        grep,
      ],
      {
        ...environment,
        PILOT_API_URL: apiUrl,
        PILOT_WEB_URL: webUrl,
        PILOT_ARTIFACTS_DIR: path.join(artifacts, `playwright-${label}`),
      },
    );
    return webUrl;
  } finally {
    await stopChildren();
  }
}

async function main() {
  let admin;
  let primaryError;
  const cleanupErrors = [];
  try {
    await startPostgres();
    admin = await connectAdmin();
    let failureProbePassed = false;
    try {
      await createOwned(admin, cleanupProbe);
      await verifyLegacySessionMigration();
      throw new Error('controlled failure');
    } catch (error) {
      if (error.message !== 'controlled failure') throw error;
      failureProbePassed = true;
    } finally {
      await dropOwned(admin, cleanupProbe);
    }
    assert.equal(failureProbePassed, true);

    const databaseUrl = disposableUrl(database);
    const environment = {
      DATABASE_URL: databaseUrl,
      NODE_ENV: 'test',
      PILOT_TEST_RUN_ID: suffix,
      PILOT_TEST_DB_MARKER: marker,
    };
    await createOwned(admin, database);
    run('pnpm', ['--filter', '@meinager/api', 'exec', 'prisma', 'migrate', 'deploy'], environment);
    run('pnpm', ['--filter', '@meinager/api', 'build'], environment);
    const smokePort = await freePort();
    const smokeApi = start(
      'node',
      ['apps/api/dist/main.js'],
      { ...environment, PORT: String(smokePort), API_HOST: '127.0.0.1' },
      'compiled-api',
    );
    await waitFor(`http://127.0.0.1:${smokePort}/api/health`, smokeApi);
    console.log('COMPILED_API_HEALTH_OK');
    await stopChildren();
    if (process.env.PILOT_TEST_FULL_API === 'YES') {
      run('node', ['apps/api/test/pricing/configuration-e2e-postgres.cjs'], {
        ...environment,
        PRICING_TEST_CONFIRM_DISPOSABLE: 'YES',
      });
    }
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
        ...(process.env.PILOT_TEST_FULL_API === 'YES'
          ? ['--exclude', 'test/pricing-*.e2e-spec.ts', '--no-file-parallelism']
          : ['test/quotes.e2e-spec.ts', 'test/orders.e2e-spec.ts', 'test/products.e2e-spec.ts']),
      ],
      environment,
    );
    if (process.env.PILOT_TEST_FORCE_FAILURE === 'AFTER_MIGRATIONS') {
      throw new Error('Controlled pilot failure after migrations');
    }
    const firstGrep = process.env.PILOT_TEST_GREP ?? 'convites resistem|percursos fictícios';
    const webUrl = await runBrowserRound(environment, firstGrep, 'operations');
    if (!process.env.PILOT_TEST_GREP) {
      await runBrowserRound(environment, 'convite exige aceite', 'invitation');
      await runBrowserRound(environment, 'cadastro guiado local', 'guided-setup');
    }
    await verifyBackupAndRestore(admin, databaseUrl, environment, webUrl);
  } catch (error) {
    primaryError = error;
  } finally {
    async function cleanup(label, action) {
      try {
        await action();
      } catch (error) {
        cleanupErrors.push(new Error(`${label}: ${error.message}`));
      }
    }
    await cleanup('servers', stopChildren);
    if (admin) {
      for (const name of [...owned]) {
        await cleanup(`database ${name}`, () => dropOwned(admin, name));
      }
      await cleanup('admin connection', () => admin.end());
    }
    await cleanup('container', stopPostgres);
    await cleanup('artifacts', () => sanitizeArtifacts(artifacts));
    console.log(`EVIDENCE_DIR ${artifacts}`);
  }
  if (primaryError || cleanupErrors.length) {
    throw new AggregateError(
      [...(primaryError ? [primaryError] : []), ...cleanupErrors],
      'Pilot run or cleanup failed',
    );
  }
}

main().catch((error) => {
  for (const cause of error.errors ?? [error]) {
    console.error(safeOutput(String(cause.message ?? cause)));
  }
  process.exitCode = interruptedBy === 'SIGINT' ? 130 : interruptedBy === 'SIGTERM' ? 143 : 1;
});
