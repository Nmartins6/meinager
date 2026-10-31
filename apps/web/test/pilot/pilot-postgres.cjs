/* Owns a disposable PostgreSQL database, localhost servers and browser test. */
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
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
  assert.match(name, /^meinager_pilot(?:_cleanup)?_[a-f0-9]{16}$/);
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
  for (const child of children.reverse()) {
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
      throw new Error('controlled failure');
    } catch (error) {
      assert.equal(error.message, 'controlled failure');
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
    if (process.env.PILOT_TEST_FORCE_FAILURE === 'AFTER_MIGRATIONS') {
      throw new Error('Controlled pilot failure after migrations');
    }
    const apiPort = await freePort();
    const webPort = await freePort();
    assert.notEqual(apiPort, webPort);
    const apiUrl = `http://127.0.0.1:${apiPort}`;
    const webUrl = `http://127.0.0.1:${webPort}`;
    const api = start(
      'node',
      ['apps/api/test/pilot-server.mjs'],
      {
        ...environment,
        PORT: String(apiPort),
        WEB_ORIGIN: webUrl,
      },
      'api',
    );
    await waitFor(`${apiUrl}/__pilot_ready_${suffix}`, api);
    const web = start(
      'pnpm',
      [
        '--filter',
        '@meinager/web',
        'exec',
        'vite',
        '--host',
        '127.0.0.1',
        '--port',
        String(webPort),
        '--strictPort',
      ],
      {
        ...environment,
        VITE_API_URL: `${apiUrl}/api`,
      },
      'web',
    );
    await waitFor(webUrl, web);
    console.log(`PILOT_URLS api=${apiUrl} web=${webUrl}`);
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
      ],
      {
        ...environment,
        PILOT_API_URL: apiUrl,
        PILOT_WEB_URL: webUrl,
        PILOT_ARTIFACTS_DIR: path.join(artifacts, 'playwright'),
      },
    );
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
