/* Standalone migration/guard suite. Creates only owned, uniquely named test databases. */
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const {
  mkdtempSync,
  cpSync,
  writeFileSync,
  readdirSync,
  rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../../..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
apiRequire('dotenv').config({ path: path.join(root, '.env'), quiet: true });
const { Client } = apiRequire('pg');
const migration = '20261003181002_add_pricing_persistence';
const prefix = 'pricing_guard_test_';
const suffix = randomBytes(8).toString('hex');
const names = [prefix + 'empty_' + suffix, prefix + 'baseline_' + suffix];
const role = prefix + 'app_' + suffix;
const password = randomBytes(24).toString('hex');
const ownership = 'Meinager disposable pricing guards ' + suffix;
const owned = new Set();
let count = 0;
let app;
let owner;
let admin;
let roleCreated = false;
let temporary;
const extraConnections = new Set();
function target(name) {
  assert.match(name, /^pricing_guard_test_(empty|baseline)_[a-f0-9]{16}$/);
  assert.ok(names.includes(name));
  assert.ok(!['postgres', 'meinager', ''].includes(name));
  return name;
}
function connection(database, application = false) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/' + database;
  if (application) {
    url.username = role;
    url.password = password;
  }
  return url.toString();
}
async function connect(database, application = false) {
  const c = new Client({
    connectionString: connection(database, application),
    connectionTimeoutMillis: 5000,
  });
  await c.connect();
  return c;
}
async function check(label, fn) {
  await fn();
  count++;
  console.log('PASS ' + label);
}
async function transaction(
  fn,
  rejected = false,
  codes = ['23514', '23503', '23505'],
  c = app,
) {
  await c.query('BEGIN');
  let error;
  try {
    await fn();
    await c.query('COMMIT');
  } catch (e) {
    error = e;
    await c.query('ROLLBACK');
  }
  if (rejected) {
    assert.ok(error, 'Expected transaction rejection');
    assert.ok(
      codes.includes(error.code),
      'Unexpected rejection: ' + error.code + ' ' + error.message,
    );
  } else if (error) throw error;
}
function deploy(database, config) {
  target(database);
  assert.ok(owned.has(database));
  const args = [
    '--filter',
    '@meinager/api',
    'exec',
    'prisma',
    'migrate',
    'deploy',
  ];
  if (config) args.push('--config', config);
  const result = spawnSync('pnpm', args, {
    cwd: root,
    env: { ...process.env, DATABASE_URL: connection(database) },
    encoding: 'utf8',
    timeout: 60000,
  });
  assert.equal(
    result.status,
    0,
    (result.stdout + result.stderr).replaceAll(
      connection(database),
      '[test database]',
    ),
  );
}
async function fixture(c) {
  const org = randomUUID(),
    user = randomUUID(),
    product = randomUUID(),
    source = randomUUID();
  await c.query(
    'INSERT INTO public.organizations(id,name,slug,updated_at) VALUES($1,$2,$3,now())',
    [org, 'Pricing test', randomUUID()],
  );
  await c.query(
    'INSERT INTO public.users(id,name,email,normalized_email,password_hash,updated_at) VALUES($1,$2,$3,$3,$4,now())',
    [user, 'Test actor', randomUUID() + '@example.com', 'test-only'],
  );
  for (const id of [product, source])
    await c.query(
      'INSERT INTO public.products(id,organization_id,name,normalized_name,unit,direct_cost,sale_price,updated_at) VALUES($1,$2,$3,$3,$4,$5,$6,now())',
      [id, org, 'Test item', 'UN', '10', '12'],
    );
  return { org, user, product, source };
}
async function commercial(c, f) {
  const client = randomUUID(),
    quote = randomUUID(),
    workflow = randomUUID(),
    stage = randomUUID(),
    order = randomUUID();
  await c.query(
    'INSERT INTO clients(id,organization_id,name,updated_at) VALUES($1,$2,$3,now())',
    [client, f.org, 'Snapshot client'],
  );
  await c.query(
    "INSERT INTO financial_quotes(id,organization_id,client_id,number,status,subtotal,total,updated_at) VALUES($1,$2,$3,1,'APPROVED',12,12,now())",
    [quote, f.org, client],
  );
  await c.query(
    "INSERT INTO financial_quote_items(id,organization_id,quote_id,product_id,position,description,unit,quantity,unit_price,total,updated_at) VALUES($1,$2,$3,$4,1,'Frozen quote','UN',1,12,12,now())",
    [randomUUID(), f.org, quote, f.product],
  );
  await c.query(
    'INSERT INTO order_workflows(id,organization_id,name,normalized_name,updated_at) VALUES($1,$2,$3,$3,now())',
    [workflow, f.org, 'Test workflow'],
  );
  await c.query(
    "INSERT INTO order_workflow_stages(id,organization_id,workflow_id,name,position,category,updated_at) VALUES($1,$2,$3,'Test',1,'PENDING',now())",
    [stage, f.org, workflow],
  );
  await c.query(
    'INSERT INTO orders(id,organization_id,quote_id,client_id,workflow_id,current_stage_id,number,subtotal,total,updated_at) VALUES($1,$2,$3,$4,$5,$6,1,12,12,now())',
    [order, f.org, quote, client, workflow, stage],
  );
  await c.query(
    "INSERT INTO order_items(id,organization_id,order_id,product_id,position,description,unit,quantity,unit_price,total,updated_at) VALUES($1,$2,$3,$4,1,'Frozen order','UN',1,12,12,now())",
    [randomUUID(), f.org, order, f.product],
  );
}
async function commercialState(c) {
  const result = {};
  for (const table of [
    'financial_quotes',
    'financial_quote_items',
    'orders',
    'order_items',
  ])
    result[table] = (
      await c.query(`SELECT to_jsonb(t) AS data FROM ${table} t ORDER BY id`)
    ).rows;
  return result;
}
async function grants(database) {
  await owner.query(
    `GRANT CONNECT ON DATABASE "${target(database)}" TO "${role}"`,
  );
  await owner.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
  await owner.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${role}"`,
  );
  await owner.query(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"`,
  );
  // No ownership, DDL, schema creation, private-table or private-function grants.
  app = await connect(database, true);
  assert.equal(
    (await app.query('SELECT current_database() AS name')).rows[0].name,
    database,
  );
}
async function revision(
  f,
  kind,
  rootId,
  number,
  move = true,
  deduction = false,
  c = app,
) {
  const id = randomUUID();
  const rootTable =
    kind === 'PROFILE'
      ? 'pricing_sales_profiles'
      : 'organization_pricing_configurations';
  const revisionTable =
    kind === 'PROFILE'
      ? 'pricing_sales_profile_revisions'
      : 'organization_pricing_configuration_revisions';
  if (number === 1)
    await c.query(
      `INSERT INTO ${rootTable}(id,organization_id,created_by_user_id,updated_by_user_id,updated_at) VALUES($1,$2,$3,$3,now())`,
      [rootId, f.org, f.user],
    );
  if (kind === 'PROFILE')
    await c.query(
      `INSERT INTO ${revisionTable}(id,organization_id,profile_id,revision,name,effective_from,created_by_user_id) VALUES($1,$2,$3,$4,'Test profile',now(),$5)`,
      [id, f.org, rootId, number, f.user],
    );
  else
    await c.query(
      `INSERT INTO ${revisionTable}(id,organization_id,configuration_id,revision,effective_from,parameter_origins,created_by_user_id) VALUES($1,$2,$3,$4,now(),'{}',$5)`,
      [id, f.org, rootId, number, f.user],
    );
  if (deduction) await insertDeduction(f, id, 1, c);
  if (move)
    await c.query(
      `UPDATE ${rootTable} SET current_revision_id=$1 WHERE id=$2`,
      [id, rootId],
    );
  return id;
}
async function insertDeduction(f, id, position = 1, c = app) {
  await c.query(
    "INSERT INTO public.pricing_deductions(id,organization_id,profile_revision_id,position,name,category,rate,origin) VALUES($1,$2,$3,$4,'Tax','TAX',0.1,'MANUAL')",
    [randomUUID(), f.org, id, position],
  );
}
let versionNumber = 0;
async function version(f, options = {}, c = app) {
  const id = randomUUID();
  const component = {
    description: 'Direct cost',
    category: 'DIRECT_COST',
    unit: 'UN',
    quantity: '1',
    unitCost: '10',
    origin: 'MANUAL',
    total: { exact: '10', display: '10.00' },
  };
  const deduction = {
    name: 'Tax',
    category: 'TAX',
    rate: '0.1',
    origin: 'MANUAL',
    amount: { exact: '1.25', display: '1.25' },
  };
  const result = {
    currency: 'BRL',
    formulaVersion: 'margin-divisor-v1',
    components: [component],
    minimumPrice: { commercial: '11.12' },
    suggestedPrice: { commercial: '12.50' },
    analysis: {
      price: options.price ?? '12.50',
      classification: options.classification ?? 'DESIRED_MARGIN_MET',
      deductions: [deduction],
    },
  };
  const snapshot = { input: { currency: 'BRL' }, result, context: {} };
  await c.query(
    "INSERT INTO public.pricing_calculation_versions(id,organization_id,product_id,number,snapshot,minimum_price_commercial,suggested_price_commercial,analyzed_price,classification,component_count,deduction_count,formula_version,snapshot_schema_version,created_by_user_id) VALUES($1,$2,$3,$4,$5,'11.12','12.50',$6,$7,$8,1,'margin-divisor-v1',1,$9)",
    [
      id,
      f.org,
      f.product,
      ++versionNumber,
      JSON.stringify(snapshot),
      result.analysis.price,
      result.analysis.classification,
      options.count ?? 1,
      f.user,
    ],
  );
  await c.query(
    "INSERT INTO public.pricing_version_components(id,organization_id,version_id,position,description,category,unit,quantity,effective_unit_cost,total_exact,total_display,cost_source) VALUES($1,$2,$3,$4,'Direct cost','DIRECT_COST','UN',1,10,$5,'10.00','MANUAL')",
    [randomUUID(), f.org, id, options.position ?? 1, options.total ?? '10'],
  );
  await c.query(
    "INSERT INTO public.pricing_version_deductions(id,organization_id,version_id,position,name,category,rate,amount_exact,amount_display,origin) VALUES($1,$2,$3,1,'Tax','TAX',0.1,'1.25','1.25','MANUAL')",
    [randomUUID(), f.org, id],
  );
  if (options.finalize !== false)
    await c.query(
      "UPDATE public.pricing_calculation_versions SET state='FINALIZED', finalized_at=now() WHERE id=$1",
      [id],
    );
  return id;
}
async function adoptedState(f, c = app) {
  return (
    await c.query(
      'SELECT sale_price,adopted_pricing_version_id FROM public.products WHERE id=$1',
      [f.product],
    )
  ).rows[0];
}
async function event(f, id, overrides = {}, c = app) {
  const previous = overrides.previous ?? (await adoptedState(f, c));
  await c.query(
    'INSERT INTO public.pricing_price_adoptions(id,organization_id,product_id,version_id,previous_price,previous_version_id,new_price,classification,created_by_user_id,below_minimum_confirmed,justification) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [
      randomUUID(),
      overrides.org ?? f.org,
      overrides.product ?? f.product,
      id,
      previous.sale_price,
      previous.adopted_pricing_version_id,
      overrides.price ?? '12.50',
      overrides.classification ?? 'DESIRED_MARGIN_MET',
      f.user,
      overrides.confirm ?? false,
      overrides.justification ?? null,
    ],
  );
}
async function productWrite(f, id, price = '12.50', c = app) {
  await c.query(
    'UPDATE public.products SET sale_price=$1, adopted_pricing_version_id=$2 WHERE id=$3',
    [price, id, f.product],
  );
}
async function guards(f, other) {
  let finalized;
  await check('version building/finalized valid', () =>
    transaction(async () => {
      finalized = await version(f);
    }),
  );
  await check('commit BUILDING rejected', () =>
    transaction(() => version(f, { finalize: false }), true),
  );
  await check('finalized version UPDATE rejected', () =>
    transaction(
      () =>
        app.query(
          'UPDATE public.pricing_calculation_versions SET snapshot=snapshot WHERE id=$1',
          [finalized],
        ),
      true,
    ),
  );
  await check('finalized version DELETE rejected', () =>
    transaction(
      () =>
        app.query(
          'DELETE FROM public.pricing_calculation_versions WHERE id=$1',
          [finalized],
        ),
      true,
    ),
  );
  for (const table of [
    'pricing_version_components',
    'pricing_version_deductions',
  ]) {
    for (const sql of [
      'UPDATE ' + table + ' SET position=position WHERE version_id=$1',
      'DELETE FROM ' + table + ' WHERE version_id=$1',
    ])
      await check(
        'finalized projection ' + sql.split(' ')[0] + ' ' + table + ' rejected',
        () => transaction(() => app.query(sql, [finalized]), true),
      );
  }
  await check('counts rejected', () =>
    transaction(() => version(f, { count: 2 }), true),
  );
  await check('positions rejected', () =>
    transaction(() => version(f, { position: 2 }), true),
  );
  await check('snapshot/projection divergence rejected', () =>
    transaction(() => version(f, { total: '11' }), true),
  );
  await check('BUILDING external reference rejected', () =>
    transaction(
      async () => productWrite(f, await version(f, { finalize: false })),
      true,
    ),
  );
  await check('adoption event -> product valid', () =>
    transaction(async () => {
      const old = await adoptedState(f);
      await event(f, finalized, { previous: old });
      await productWrite(f, finalized);
    }),
  );
  await check('adoption product -> event valid', () =>
    transaction(async () => {
      const old = await adoptedState(f);
      await productWrite(f, finalized);
      await event(f, finalized, { previous: old });
    }),
  );
  await check('event without product write rejected even for same price', () =>
    transaction(() => event(f, finalized), true),
  );
  await check('product without event rejected', () =>
    transaction(() => productWrite(f, finalized), true),
  );
  await check('new price divergent rejected', () =>
    transaction(() => event(f, finalized, { price: '13' }), true),
  );
  await check('classification divergent rejected', () =>
    transaction(
      () => event(f, finalized, { classification: 'COST_COVERAGE' }),
      true,
    ),
  );
  await check('previous price false rejected', () =>
    transaction(async () => {
      await event(f, finalized, {
        previous: { sale_price: '999', adopted_pricing_version_id: finalized },
      });
      await productWrite(f, finalized);
    }, true),
  );
  await check('previous pointer false rejected', () =>
    transaction(async () => {
      await event(f, finalized, {
        previous: { sale_price: '12.50', adopted_pricing_version_id: null },
      });
      await productWrite(f, finalized);
    }, true),
  );
  await check('foreign organization version rejected', () =>
    transaction(() => event(other, finalized), true),
  );
  const sibling = { ...f, product: f.source };
  await check('foreign product version rejected', () =>
    transaction(() => event(sibling, finalized), true),
  );
  await check('adoption BUILDING rejected', () =>
    transaction(
      async () => event(f, await version(f, { finalize: false })),
      true,
    ),
  );
  let below;
  await transaction(async () => {
    below = await version(f, {
      price: '1.00',
      classification: 'BELOW_MINIMUM',
    });
  });
  await check('below minimum without confirmation rejected', () =>
    transaction(
      () => event(f, below, { price: '1', classification: 'BELOW_MINIMUM' }),
      true,
    ),
  );
  await check('below minimum empty justification rejected', () =>
    transaction(
      () =>
        event(f, below, {
          price: '1',
          classification: 'BELOW_MINIMUM',
          confirm: true,
          justification: ' ',
        }),
      true,
    ),
  );
  await check('manual price with cleared pointer valid', () =>
    transaction(() => productWrite(f, null, '15')),
  );
  await check('adoption savepoint valid', () =>
    transaction(async () => {
      await app.query('SAVEPOINT adoption');
      const old = await adoptedState(f);
      await productWrite(f, finalized);
      await event(f, finalized, { previous: old });
      await app.query('RELEASE SAVEPOINT adoption');
    }),
  );
  await check('adoption savepoint rollback leaves no partial state', () =>
    transaction(async () => {
      await app.query('SAVEPOINT adoption');
      await event(f, finalized);
      await app.query('ROLLBACK TO SAVEPOINT adoption');
    }),
  );
  for (const kind of ['CONFIGURATION', 'PROFILE']) {
    const rootId = randomUUID();
    const table =
      kind === 'PROFILE'
        ? 'pricing_sales_profiles'
        : 'organization_pricing_configurations';
    const revisionTable =
      kind === 'PROFILE'
        ? 'pricing_sales_profile_revisions'
        : 'organization_pricing_configuration_revisions';
    let first;
    await check(kind + ' root/first revision/pointer valid', () =>
      transaction(async () => {
        first = await revision(f, kind, rootId, 1, true, kind === 'PROFILE');
      }),
    );
    await check(kind + ' revision with pointer movement valid', () =>
      transaction(() => revision(f, kind, rootId, 2, true, kind === 'PROFILE')),
    );
    await check(kind + ' revision without pointer movement rejected', () =>
      transaction(() => revision(f, kind, rootId, 3, false), true),
    );
    await check(kind + ' pointer backwards rejected', () =>
      transaction(
        () =>
          app.query(`UPDATE ${table} SET current_revision_id=$1 WHERE id=$2`, [
            first,
            rootId,
          ]),
        true,
      ),
    );
    await check(kind + ' historical revision UPDATE rejected', () =>
      transaction(
        () =>
          app.query(
            `UPDATE ${revisionTable} SET revision=revision WHERE id=$1`,
            [first],
          ),
        true,
      ),
    );
    await check(kind + ' deactivate metadata valid', () =>
      transaction(() =>
        app.query(`UPDATE ${table} SET is_active=false WHERE id=$1`, [rootId]),
      ),
    );
    if (kind === 'PROFILE')
      await check('late deduction insert rejected', () =>
        transaction(() => insertDeduction(f, first, 2), true),
      );
    await check(kind + ' creation inside savepoint valid', () =>
      transaction(async () => {
        await app.query('SAVEPOINT revision');
        await revision(f, kind, rootId, 3, true, kind === 'PROFILE');
        await app.query('RELEASE SAVEPOINT revision');
      }),
    );
    await check(
      kind + ' new revision without pointer in savepoint rejected',
      () =>
        transaction(async () => {
          await app.query('SAVEPOINT revision');
          await revision(f, kind, rootId, 4, false);
          await app.query('RELEASE SAVEPOINT revision');
        }, true),
    );
    await check(kind + ' savepoint rollback leaves no revision', () =>
      transaction(async () => {
        await app.query('SAVEPOINT revision');
        const id = await revision(f, kind, rootId, 4, true, kind === 'PROFILE');
        await app.query('ROLLBACK TO SAVEPOINT revision');
        assert.equal(
          (await app.query(`SELECT id FROM ${revisionTable} WHERE id=$1`, [id]))
            .rowCount,
          0,
        );
      }),
    );
    if (kind === 'PROFILE')
      await check('savepoint cannot insert late historical deduction', () =>
        transaction(async () => {
          await app.query('SAVEPOINT deduction');
          await insertDeduction(f, first, 2);
        }, true),
      );
  }
  for (const table of [
    'organization_pricing_configurations',
    'pricing_sales_profiles',
  ])
    await check(table + ' root without revision rejected', () =>
      transaction(
        () =>
          app.query(
            `INSERT INTO ${table}(id,organization_id,created_by_user_id,updated_by_user_id,updated_at) VALUES($1,$2,$3,$3,now())`,
            [randomUUID(), f.org, f.user],
          ),
        true,
      ),
    );
  const composition = randomUUID();
  await transaction(() =>
    app.query(
      "INSERT INTO public.product_pricing_compositions(id,organization_id,product_id,parameter_origins,created_by_user_id,updated_by_user_id,updated_at) VALUES($1,$2,$3,'{}',$4,$4,now())",
      [composition, f.org, f.product, f.user],
    ),
  );
  await check('composition legitimate edit valid', () =>
    transaction(() =>
      app.query(
        'UPDATE public.product_pricing_compositions SET revision=revision+1, desired_margin=0.2 WHERE id=$1',
        [composition],
      ),
    ),
  );
  for (const [field, value] of [
    ['id', randomUUID()],
    ['organization_id', other.org],
    ['product_id', f.source],
    ['created_by_user_id', other.user],
    ['created_at', '2000-01-01'],
  ])
    await check('composition identity ' + field + ' rejected', () =>
      transaction(
        () =>
          app.query(
            `UPDATE public.product_pricing_compositions SET ${field}=$1, revision=revision+1 WHERE id=$2`,
            [value, composition],
          ),
        true,
      ),
    );
  await check('composition edit without revision increment rejected', () =>
    transaction(
      () =>
        app.query(
          'UPDATE public.product_pricing_compositions SET desired_margin=0.3 WHERE id=$1',
          [composition],
        ),
      true,
    ),
  );
  async function component(source = f.source, unit = 'UN') {
    await app.query(
      "INSERT INTO public.pricing_components(id,organization_id,composition_id,position,description,category,unit,quantity,cost_source,source_product_id,updated_at) VALUES($1,$2,$3,1,'Catalog','MATERIAL',$4,1,'CATALOG',$5,now())",
      [randomUUID(), f.org, composition, unit, source],
    );
  }
  await check('catalog direct self reference rejected', () =>
    transaction(() => component(f.product), true),
  );
  await check('catalog external product rejected', () =>
    transaction(() => component(other.product), true),
  );
  await check('catalog incompatible unit rejected', () =>
    transaction(() => component(f.source, 'KG'), true),
  );
  for (const [label, sql] of [
    ['inactive', 'UPDATE public.products SET is_active=false WHERE id=$1'],
    ['null cost', 'UPDATE public.products SET direct_cost=NULL WHERE id=$1'],
    ['NaN cost', "UPDATE public.products SET direct_cost='NaN' WHERE id=$1"],
  ])
    await check('catalog ' + label + ' rejected', () =>
      transaction(async () => {
        await app.query(sql, [f.source]);
        await component();
      }, true),
    );
  await check('catalog negative cost rejected before composition', () =>
    transaction(
      () =>
        app.query('UPDATE public.products SET direct_cost=-1 WHERE id=$1', [
          f.source,
        ]),
      true,
    ),
  );
  await check('catalog explicit zero cost valid', () =>
    transaction(async () => {
      await app.query('UPDATE public.products SET direct_cost=0 WHERE id=$1', [
        f.source,
      ]);
      await component();
      await bumpComposition(app, composition);
    }),
  );
  await check(
    'composition cannot become self reference by changing product',
    () =>
      transaction(
        () =>
          app.query(
            'UPDATE public.product_pricing_compositions SET product_id=$1,revision=revision+1 WHERE id=$2',
            [f.source, composition],
          ),
        true,
      ),
  );
  await check('private bookkeeping cannot be forged', () =>
    transaction(
      () => app.query('DELETE FROM pricing_internal.product_operations'),
      true,
      ['42501'],
    ),
  );
  await check('application cannot remove triggers/table', () =>
    transaction(
      () =>
        app.query('ALTER TABLE public.pricing_components DISABLE TRIGGER ALL'),
      true,
      ['42501'],
    ),
  );
  assert.equal(
    (
      await owner.query(
        'SELECT count(*)::int AS n FROM pricing_internal.product_operations',
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await owner.query(
        'SELECT count(*)::int AS n FROM pricing_internal.revision_builds',
      )
    ).rows[0].n,
    0,
  );
}
async function bumpComposition(c, id) {
  await c.query(
    'UPDATE public.product_pricing_compositions SET revision=revision+1 WHERE id=$1',
    [id],
  );
}
async function createComposition(c, f) {
  const id = randomUUID();
  await c.query(
    "INSERT INTO public.product_pricing_compositions(id,organization_id,product_id,parameter_origins,created_by_user_id,updated_by_user_id,updated_at) VALUES($1,$2,$3,'{}',$4,$4,now())",
    [id, f.org, f.product, f.user],
  );
  return id;
}
async function manualComponent(c, f, composition, position = 1) {
  const id = randomUUID();
  await c.query(
    "INSERT INTO public.pricing_components(id,organization_id,composition_id,position,description,category,unit,quantity,cost_source,stored_unit_cost,updated_at) VALUES($1,$2,$3,$4,'Manual','MATERIAL','UN',1,'MANUAL',10,now())",
    [id, f.org, composition, position],
  );
  return id;
}
async function assertNoBookkeeping() {
  for (const table of [
    'product_operations',
    'revision_builds',
    'composition_operations',
  ])
    assert.equal(
      (
        await owner.query(
          `SELECT count(*)::int AS n FROM pricing_internal.${table}`,
        )
      ).rows[0].n,
      0,
    );
}
async function compositionGuards(_f, other) {
  const f = await fixture(app);
  let parent, item;
  await check('composition initial components keep revision one', () =>
    transaction(async () => {
      parent = await createComposition(app, f);
      item = await manualComponent(app, f, parent);
    }),
  );
  assert.equal(
    (
      await app.query(
        'SELECT revision FROM public.product_pricing_compositions WHERE id=$1',
        [parent],
      )
    ).rows[0].revision,
    1,
  );
  const update = () =>
    app.query('UPDATE public.pricing_components SET quantity=2 WHERE id=$1', [
      item,
    ]);
  const remove = () =>
    app.query('DELETE FROM public.pricing_components WHERE id=$1', [item]);
  for (const [label, fn] of [
    ['insert', () => manualComponent(app, f, parent, 2)],
    ['update', update],
    ['delete', remove],
  ])
    await check(
      'component ' + label + ' without parent increment rejected',
      () => transaction(fn, true, ['23514']),
    );
  await check('component insert then parent increment valid', () =>
    transaction(async () => {
      await manualComponent(app, f, parent, 2);
      await bumpComposition(app, parent);
    }),
  );
  await check('parent increment then component update valid', () =>
    transaction(async () => {
      await bumpComposition(app, parent);
      await update();
    }),
  );
  await check('component delete with increment valid', () =>
    transaction(async () => {
      await remove();
      await bumpComposition(app, parent);
    }),
  );
  let newItem;
  await check('multiple component edits require only one increment', () =>
    transaction(async () => {
      newItem = await manualComponent(app, f, parent, 3);
      await app.query(
        'UPDATE public.pricing_components SET quantity=3 WHERE id=$1',
        [newItem],
      );
      await app.query(
        'DELETE FROM public.pricing_components WHERE composition_id=$1 AND position=2',
        [parent],
      );
      await bumpComposition(app, parent);
    }),
  );
  const sibling = { ...f, product: f.source };
  let otherParent;
  await transaction(async () => {
    otherParent = await createComposition(app, sibling);
  });
  for (const [field, value] of [
    ['composition_id', otherParent],
    ['organization_id', other.org],
    ['id', randomUUID()],
    ['created_at', '2000-01-01'],
  ])
    await check('component immutable ' + field + ' rejected', () =>
      transaction(
        async () => {
          await app.query(
            `UPDATE public.pricing_components SET ${field}=$1 WHERE id=$2`,
            [value, newItem],
          );
          await bumpComposition(app, parent);
        },
        true,
        ['23514'],
      ),
    );
  await check('two parent increments for component edit rejected', () =>
    transaction(
      async () => {
        await app.query(
          'UPDATE public.pricing_components SET quantity=4 WHERE id=$1',
          [newItem],
        );
        await bumpComposition(app, parent);
        await bumpComposition(app, parent);
      },
      true,
      ['23514'],
    ),
  );
  await check('component savepoint rollback followed by valid edit', () =>
    transaction(async () => {
      await app.query('SAVEPOINT component_edit');
      const cancelled = await manualComponent(app, f, parent, 4);
      await bumpComposition(app, parent);
      await app.query('ROLLBACK TO SAVEPOINT component_edit');
      assert.equal(
        (
          await app.query(
            'SELECT id FROM public.pricing_components WHERE id=$1',
            [cancelled],
          )
        ).rowCount,
        0,
      );
      await app.query(
        'UPDATE public.pricing_components SET quantity=5 WHERE id=$1',
        [newItem],
      );
      await bumpComposition(app, parent);
    }),
  );
  await check('private composition bookkeeping is inaccessible', () =>
    transaction(
      () => app.query('DELETE FROM pricing_internal.composition_operations'),
      true,
      ['42501'],
    ),
  );
  await check(
    'composition bookkeeping leaves no commit/rollback residue',
    assertNoBookkeeping,
  );
}
async function withConnections(database, n, fn) {
  target(database);
  assert.ok(owned.has(database));
  const clients = [];
  try {
    for (let i = 0; i < n; i++) {
      const c = await connect(database, true);
      extraConnections.add(c);
      clients.push(c);
      await c.query("SET statement_timeout='8s'; SET lock_timeout='6s'");
    }
    return await fn(...clients);
  } finally {
    for (const c of clients) {
      await c.query('ROLLBACK').catch(() => {});
      await c.end();
      extraConnections.delete(c);
    }
  }
}
async function rejection(c, fn, message) {
  await c.query('BEGIN');
  let error;
  try {
    await fn();
    await c.query('COMMIT');
  } catch (e) {
    error = e;
    await c.query('ROLLBACK');
  }
  assert.ok(error, 'Expected hostile operation rejection');
  assert.equal(error.code, '23514');
  assert.match(error.message, message);
}
async function fakeVersions(c, id, state) {
  await c.query(
    'CREATE TEMP TABLE pricing_calculation_versions (LIKE public.pricing_calculation_versions)',
  );
  await c.query(
    'INSERT INTO pg_temp.pricing_calculation_versions SELECT * FROM public.pricing_calculation_versions WHERE id=$1',
    [id],
  );
  await c.query('UPDATE pg_temp.pricing_calculation_versions SET state=$1', [
    state,
  ]);
  await c.query('SET search_path=pg_temp,public');
}
async function shadowing(database) {
  const f = await fixture(app);
  let finalized;
  await transaction(async () => {
    finalized = await version(f);
  });
  await check('shadow BUILDING cannot hide from deferred finalization', () =>
    withConnections(database, 1, async (c) => {
      // New session: fake relation exists before its first pricing function invocation.
      await c.query(
        'CREATE TEMP TABLE pricing_calculation_versions (LIKE public.pricing_calculation_versions)',
      );
      await c.query('SET search_path=pg_temp,public');
      await rejection(
        c,
        async () => {
          const id = await version(f, { finalize: false }, c);
          await c.query(
            'INSERT INTO pg_temp.pricing_calculation_versions SELECT * FROM public.pricing_calculation_versions WHERE id=$1',
            [id],
          );
          await c.query(
            "UPDATE pg_temp.pricing_calculation_versions SET state='FINALIZED'",
          );
        },
        /must finalize/,
      );
    }),
  );
  for (const operation of ['INSERT', 'UPDATE'])
    await check('shadow BUILDING cannot permit projection ' + operation, () =>
      withConnections(database, 1, async (c) => {
        await fakeVersions(c, finalized, 'BUILDING');
        await rejection(
          c,
          () =>
            operation === 'UPDATE'
              ? c.query(
                  'UPDATE public.pricing_version_components SET quantity=quantity WHERE version_id=$1',
                  [finalized],
                )
              : c.query(
                  "INSERT INTO public.pricing_version_components(id,organization_id,version_id,position,description,category,unit,quantity,effective_unit_cost,total_exact,total_display,cost_source) VALUES($1,$2,$3,2,'Fake','DIRECT_COST','UN',1,10,'10','10.00','MANUAL')",
                  [randomUUID(), f.org, finalized],
                ),
          /projection of finalized/,
        );
      }),
    );
  await check('shadow adoption cannot substitute fake analyzed price', () =>
    withConnections(database, 1, async (c) => {
      await fakeVersions(c, finalized, 'FINALIZED');
      await c.query(
        "UPDATE pg_temp.pricing_calculation_versions SET analyzed_price='13.00'",
      );
      await rejection(
        c,
        () => event(f, finalized, { price: '13' }, c),
        /price\/classification must match/,
      );
    }),
  );
  await check(
    'shadow fake FINALIZED cannot authorize real BUILDING adoption',
    () =>
      withConnections(database, 1, async (c) => {
        await c.query(
          'CREATE TEMP TABLE pricing_calculation_versions (LIKE public.pricing_calculation_versions)',
        );
        await c.query('SET search_path=pg_temp,public');
        await rejection(
          c,
          async () => {
            const id = await version(f, { finalize: false }, c);
            await c.query(
              'INSERT INTO pg_temp.pricing_calculation_versions SELECT * FROM public.pricing_calculation_versions WHERE id=$1',
              [id],
            );
            await c.query(
              "UPDATE pg_temp.pricing_calculation_versions SET state='FINALIZED'",
            );
            await event(f, id, {}, c);
          },
          /requires a finalized version/,
        );
      }),
  );
  const compFixture = await fixture(app);
  let composition;
  await transaction(async () => {
    composition = await createComposition(app, compFixture);
  });
  await app.query('UPDATE public.products SET is_active=false WHERE id=$1', [
    compFixture.source,
  ]);
  await check(
    'shadow active catalogue cannot replace real inactive product',
    () =>
      withConnections(database, 1, async (c) => {
        await c.query('CREATE TEMP TABLE products (LIKE public.products)');
        await c.query(
          'INSERT INTO pg_temp.products SELECT * FROM public.products WHERE id=$1',
          [compFixture.source],
        );
        await c.query(
          'UPDATE pg_temp.products SET is_active=true,direct_cost=10',
        );
        await c.query(
          'CREATE TEMP TABLE product_pricing_compositions (LIKE public.product_pricing_compositions)',
        );
        await c.query(
          'INSERT INTO pg_temp.product_pricing_compositions SELECT * FROM public.product_pricing_compositions WHERE id=$1',
          [composition],
        );
        await c.query('SET search_path=pg_temp,public');
        await rejection(
          c,
          () =>
            c.query(
              "INSERT INTO public.pricing_components(id,organization_id,composition_id,position,description,category,unit,quantity,cost_source,source_product_id,updated_at) VALUES($1,$2,$3,1,'Catalog','MATERIAL','UN',1,'CATALOG',$4,now())",
              [randomUUID(), compFixture.org, composition, compFixture.source],
            ),
          /Catalog component requires/,
        );
      }),
  );
  await check(
    'shadow product/version cannot hide real analysis price mismatch',
    () =>
      withConnections(database, 1, async (c) => {
        await fakeVersions(c, finalized, 'FINALIZED');
        await c.query(
          "UPDATE pg_temp.pricing_calculation_versions SET analyzed_price='13.00'",
        );
        await c.query('CREATE TEMP TABLE products (LIKE public.products)');
        await c.query(
          'INSERT INTO pg_temp.products SELECT * FROM public.products WHERE id=$1',
          [f.product],
        );
        await c.query(
          'UPDATE pg_temp.products SET sale_price=13,adopted_pricing_version_id=$1',
          [finalized],
        );
        await rejection(
          c,
          async () => {
            await productWrite(f, finalized, '13', c);
            // Exercise the analysis-price guard directly, independently of adoption's guard.
            await c.query(
              'SET CONSTRAINTS public.pricing_products_analysis_price IMMEDIATE',
            );
          },
          /sale price must match/,
        );
      }),
  );
  await check(
    'catalogue guard uses real zero cost despite negative temporary source',
    () =>
      withConnections(database, 1, async (c) => {
        const real = await fixture(app);
        let parent;
        await transaction(async () => {
          parent = await createComposition(app, real);
        });
        await app.query(
          'UPDATE public.products SET direct_cost=0 WHERE id=$1',
          [real.source],
        );
        await c.query('CREATE TEMP TABLE products (LIKE public.products)');
        await c.query(
          'INSERT INTO pg_temp.products SELECT * FROM public.products WHERE id=$1',
          [real.source],
        );
        await c.query('UPDATE pg_temp.products SET direct_cost=-1');
        await c.query('SET search_path=pg_temp,public');
        await transaction(
          async () => {
            await c.query(
              "INSERT INTO public.pricing_components(id,organization_id,composition_id,position,description,category,unit,quantity,cost_source,source_product_id,updated_at) VALUES($1,$2,$3,1,'Catalog','MATERIAL','UN',1,'CATALOG',$4,now())",
              [randomUUID(), real.org, parent, real.source],
            );
            await bumpComposition(c, parent);
          },
          false,
          undefined,
          c,
        );
        const definition = (
          await owner.query(
            "SELECT pg_catalog.pg_get_functiondef('public.pricing_guard_catalog_component()'::regprocedure) AS body",
          )
        ).rows[0].body;
        assert.match(definition, /source\.direct_cost < 0/);
        assert.match(definition, /FROM public\.products/);
      }),
  );
  await check(
    'application role retains TEMP without DDL/owner/admin/private privileges',
    async () => {
      const privileges = (
        await app.query(
          "SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,has_database_privilege(current_database(),'TEMP') AS temp,has_schema_privilege('public','CREATE') AS ddl,has_schema_privilege('pricing_internal','USAGE') AS private FROM pg_catalog.pg_roles WHERE rolname=current_user",
        )
      ).rows[0];
      assert.deepEqual(privileges, {
        rolsuper: false,
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        temp: true,
        ddl: false,
        private: false,
      });
      assert.equal(
        (
          await owner.query(
            "SELECT count(*)::int AS n FROM pg_catalog.pg_class WHERE relowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=$1) AND relnamespace IN ('public'::regnamespace,'pricing_internal'::regnamespace)",
            [role],
          )
        ).rows[0].n,
        0,
      );
      const functions = (
        await owner.query(
          "SELECT p.proconfig FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname LIKE 'pricing_%') OR n.nspname='pricing_internal'",
        )
      ).rows;
      assert.ok(functions.length > 0);
      for (const fn of functions)
        assert.ok(
          fn.proconfig.includes('search_path=pg_catalog, public, pg_temp'),
        );
    },
  );
}
async function waitForLock(c) {
  const pid = (await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  return pid;
}
async function blocked(pid) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (
      (
        await owner.query(
          'SELECT wait_event_type FROM pg_catalog.pg_stat_activity WHERE pid=$1',
          [pid],
        )
      ).rows[0]?.wait_event_type === 'Lock'
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Expected concurrent session waiting on real lock');
}
async function concurrentAttempt(c, fn) {
  try {
    await fn();
    await c.query('COMMIT');
    return { committed: true };
  } catch (e) {
    await c.query('ROLLBACK');
    return { committed: false, error: e };
  }
}
async function concurrentGuards(database) {
  const f = await fixture(app),
    rootId = randomUUID();
  await transaction(() => revision(f, 'CONFIGURATION', rootId, 1));
  await check(
    'concurrent configuration revisions serialize with no duplicate/orphan',
    () =>
      withConnections(database, 2, async (a, b) => {
        const pid = await waitForLock(b);
        await a.query('BEGIN');
        await b.query('BEGIN');
        await a.query(
          'SELECT id FROM public.organization_pricing_configurations WHERE id=$1 FOR UPDATE',
          [rootId],
        );
        const first = await revision(
          f,
          'CONFIGURATION',
          rootId,
          2,
          true,
          false,
          a,
        );
        const contender = concurrentAttempt(b, () =>
          revision(f, 'CONFIGURATION', rootId, 2, true, false, b),
        );
        await blocked(pid);
        await a.query('COMMIT');
        const result = await contender;
        assert.equal(result.committed, false);
        assert.equal(result.error.code, '23505');
        const rows = (
          await app.query(
            'SELECT r.id,r.revision,c.current_revision_id FROM public.organization_pricing_configuration_revisions r JOIN public.organization_pricing_configurations c ON c.id=r.configuration_id WHERE c.id=$1 ORDER BY r.revision',
            [rootId],
          )
        ).rows;
        assert.equal(rows.length, 2);
        assert.equal(rows[1].revision, 2);
        assert.equal(rows[1].id, first);
        assert.equal(rows[1].current_revision_id, first);
      }),
  );
  let v1, v2;
  await transaction(async () => {
    v1 = await version(f, { price: '13.00' });
    v2 = await version(f, { price: '14.00' });
  });
  await check(
    'concurrent adoptions confirm two real serialized transitions',
    () =>
      withConnections(database, 2, async (a, b) => {
        const pid = await waitForLock(b);
        await a.query('BEGIN');
        await b.query('BEGIN');
        await a.query('SELECT id FROM public.products WHERE id=$1 FOR UPDATE', [
          f.product,
        ]);
        const previous = await adoptedState(f, a);
        await event(f, v1, { price: '13', previous }, a);
        await productWrite(f, v1, '13', a);
        const contender = concurrentAttempt(b, async () => {
          await b.query(
            'SELECT id FROM public.products WHERE id=$1 FOR UPDATE',
            [f.product],
          );
          const current = await adoptedState(f, b);
          assert.equal(current.sale_price, '13.00');
          assert.equal(current.adopted_pricing_version_id, v1);
          await productWrite(f, v2, '14', b);
          await event(f, v2, { price: '14', previous: current }, b);
        });
        await blocked(pid);
        await a.query('COMMIT');
        // Verify first committed state before the contender is allowed to overwrite it
        // via its own locked reread (its assertions prove that committed transition).
        const result = await contender;
        assert.equal(result.committed, true);
        const final = (
          await app.query(
            'SELECT p.sale_price,p.adopted_pricing_version_id,v.state,v.analyzed_price FROM public.products p JOIN public.pricing_calculation_versions v ON v.id=p.adopted_pricing_version_id WHERE p.id=$1',
            [f.product],
          )
        ).rows[0];
        assert.equal(final.sale_price, '14.00');
        assert.equal(final.adopted_pricing_version_id, v2);
        assert.equal(final.state, 'FINALIZED');
        assert.equal(final.analyzed_price, '14.00');
        const events = (
          await app.query(
            'SELECT version_id,previous_version_id,previous_price,new_price FROM public.pricing_price_adoptions WHERE product_id=$1 ORDER BY new_price',
            [f.product],
          )
        ).rows;
        assert.deepEqual(events, [
          {
            version_id: v1,
            previous_version_id: null,
            previous_price: previous.sale_price,
            new_price: '13.00',
          },
          {
            version_id: v2,
            previous_version_id: v1,
            previous_price: '13.00',
            new_price: '14.00',
          },
        ]);
      }),
  );
  const editFixture = await fixture(app);
  let composition, item;
  await transaction(async () => {
    composition = await createComposition(app, editFixture);
    item = await manualComponent(app, editFixture, composition);
  });
  await check(
    'concurrent expectedRevision composition permits exactly one winner',
    () =>
      withConnections(database, 2, async (a, b) => {
        const pid = await waitForLock(b);
        await a.query('BEGIN');
        await b.query('BEGIN');
        assert.equal(
          (
            await a.query(
              'SELECT revision FROM public.product_pricing_compositions WHERE id=$1',
              [composition],
            )
          ).rows[0].revision,
          1,
        );
        assert.equal(
          (
            await b.query(
              'SELECT revision FROM public.product_pricing_compositions WHERE id=$1',
              [composition],
            )
          ).rows[0].revision,
          1,
        );
        await a.query(
          'UPDATE public.product_pricing_compositions SET revision=revision+1 WHERE id=$1 AND revision=1',
          [composition],
        );
        await a.query(
          'UPDATE public.pricing_components SET quantity=2 WHERE id=$1',
          [item],
        );
        const contender = concurrentAttempt(b, async () => {
          const updated = await b.query(
            'UPDATE public.product_pricing_compositions SET revision=revision+1 WHERE id=$1 AND revision=1',
            [composition],
          );
          assert.equal(
            updated.rowCount,
            0,
            'Stale expectedRevision must not update',
          );
          throw Object.assign(new Error('Stale expectedRevision'), {
            code: 'STALE_REVISION',
          });
        });
        await blocked(pid);
        await a.query('COMMIT');
        const result = await contender;
        assert.equal(result.committed, false);
        assert.equal(result.error.code, 'STALE_REVISION');
        assert.equal(
          (
            await app.query(
              'SELECT revision FROM public.product_pricing_compositions WHERE id=$1',
              [composition],
            )
          ).rows[0].revision,
          2,
        );
        assert.equal(
          (
            await app.query(
              'SELECT quantity FROM public.pricing_components WHERE id=$1',
              [item],
            )
          ).rows[0].quantity,
          '2.000000',
        );
      }),
  );
}

async function main() {
  assert.equal(
    process.env.PRICING_TEST_CONFIRM_DISPOSABLE,
    'YES',
    'Explicit disposable-target confirmation required',
  );
  names.forEach(target);
  console.log(
    'Confirmed exclusively disposable, newly created targets:',
    names.join(', '),
  );
  admin = await connect('postgres');
  assert.ok(
    (
      await admin.query(
        'SELECT rolcreatedb,rolsuper FROM pg_roles WHERE rolname=current_user',
      )
    ).rows[0].rolsuper,
    'Administrative migration/test provisioning credential required',
  );
  assert.equal(
    (
      await admin.query(
        'SELECT datname FROM pg_database WHERE datname=ANY($1)',
        [names],
      )
    ).rowCount,
    0,
    'Never reuse an existing database',
  );
  await admin.query(
    `CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT`,
  );
  roleCreated = true;
  temporary = mkdtempSync(path.join(tmpdir(), 'meinager-pricing-'));
  const baselinePath = path.join(temporary, 'migrations');
  const migrationsPath = path.join(root, 'apps/api/prisma/migrations');
  for (const name of readdirSync(migrationsPath))
    if (name !== migration)
      cpSync(path.join(migrationsPath, name), path.join(baselinePath, name), {
        recursive: true,
      });
  const config = path.join(temporary, 'prisma.config.ts');
  writeFileSync(
    config,
    `import { defineConfig } from ${JSON.stringify(pathToFileURL(apiRequire.resolve('prisma/config')).href)}; export default defineConfig({schema:${JSON.stringify(path.join(root, 'apps/api/prisma/schema.prisma'))},migrations:{path:${JSON.stringify(baselinePath)}},datasource:{url:process.env.DATABASE_URL}});`,
  );
  for (let i = 0; i < names.length; i++) {
    const database = target(names[i]);
    console.log('CREATE disposable database:', database);
    await admin.query(`CREATE DATABASE "${database}"`);
    owned.add(database);
    await admin.query(`COMMENT ON DATABASE "${database}" IS '${ownership}'`);
    owner = await connect(database);
    let before;
    if (i === 1) {
      deploy(database, config);
      const old = await fixture(owner);
      await check(
        'baseline cannot store negative catalogue cost without weakening existing CHECK',
        async () => {
          await owner.query('BEGIN');
          let error;
          try {
            await owner.query(
              'UPDATE public.products SET direct_cost=-1 WHERE id=$1',
              [old.source],
            );
          } catch (e) {
            error = e;
          } finally {
            await owner.query('ROLLBACK');
          }
          assert.equal(error?.code, '23514');
          assert.equal(error.constraint, 'products_direct_cost_check');
        },
      );
      await commercial(owner, old);
      before = await commercialState(owner);
    }
    await check(
      i === 0
        ? 'Prisma replay from empty database'
        : 'Prisma migration over populated baseline',
      async () => deploy(database),
    );
    await check(
      'Prisma repeated deploy applies migration only once ' + i,
      async () => {
        deploy(database);
        assert.equal(
          (
            await owner.query(
              'SELECT count(*)::int AS n FROM _prisma_migrations WHERE migration_name=$1 AND finished_at IS NOT NULL',
              [migration],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    if (before)
      await check('existing products/quotes/orders preserved', async () => {
        assert.deepEqual(await commercialState(owner), before);
        assert.equal(
          (
            await owner.query(
              'SELECT count(*)::int AS n FROM public.products WHERE adopted_pricing_version_id IS NOT NULL',
            )
          ).rows[0].n,
          0,
        );
      });
    await grants(database);
    const f = await fixture(app),
      other = await fixture(app);
    await guards(f, other);
    await compositionGuards(f, other);
    await shadowing(database);
    await concurrentGuards(database);
    await assertNoBookkeeping();
    await app.end();
    app = null;
    await owner.end();
    owner = null;
  }
  console.log('PostgreSQL checks passed:', count);
}
async function cleanup() {
  for (const c of extraConnections) {
    await c.query('ROLLBACK').catch(() => {});
    await c.end();
  }
  extraConnections.clear();
  if (app) await app.end();
  if (owner) await owner.end();
  if (admin) {
    for (const database of owned) {
      target(database);
      const marker = (
        await admin.query(
          "SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1",
          [database],
        )
      ).rows[0]?.marker;
      assert.equal(
        marker,
        ownership,
        'Refuse cleanup without exact disposable ownership marker',
      );
      console.log('DROP confirmed owned disposable database:', database);
      await admin.query(`DROP DATABASE "${database}"`);
    }
    if (roleCreated) {
      assert.match(role, /^pricing_guard_test_app_[a-f0-9]{16}$/);
      await admin.query(`DROP ROLE "${role}"`);
    }
    await admin.end();
  }
  if (temporary) rmSync(temporary, { recursive: true });
}
main()
  .catch((e) => {
    console.error('FAILED', e.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
