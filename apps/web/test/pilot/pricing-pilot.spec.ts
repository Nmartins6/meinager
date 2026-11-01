import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

function canonicalDecimal(value: string) {
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

test('percursos fictícios de precificação usam API e PostgreSQL descartável', async ({
  page,
  browser,
}, testInfo) => {
  const runId = randomBytes(5).toString('hex');
  const prefix = `PILOTO FICTÍCIO ${runId}`;
  const ownerEmail = `nicolas-${runId}@example.invalid`;
  const password = `Pilot-${runId}-Pass!`;
  let productId = '';
  let clientId = '';
  let quoteId = '';
  let orderId = '';
  let adoptedVersionId = '';
  let adoptedPrice = '';
  const writes: string[] = [];
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.name));
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 500) {
      browserErrors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/api/')) {
      writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await test.step('registro e autenticação do OWNER fictício', async () => {
    await page.goto('/cadastro');
    await page.getByLabel('Nome completo').fill('Nicolas Piloto Fictício');
    await page.getByLabel('E-mail').fill(ownerEmail);
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByLabel('Confirme a senha').fill(password);
    await page.getByLabel('Nome da empresa').fill(`${prefix} Casa Nacoli`);
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page).toHaveURL(/\/app\/?$/);
  });

  await test.step('cliente fictício criado na interface', async () => {
    await page.goto('/app/clientes/novo');
    await page.getByLabel('Nome', { exact: true }).fill(`${prefix} Cliente`);
    await page.getByRole('button', { name: 'Salvar cliente' }).click();
    await expect(page).toHaveURL(/\/app\/clientes$/);
    await expect(page.getByText(`${prefix} Cliente`)).toBeVisible();
    const clients = await page.request.get(
      `${process.env.PILOT_API_URL}/api/clients?page=1&pageSize=100`,
    );
    expect(clients.status()).toBe(200);
    clientId = (await clients.json()).data.find(
      (client: { name: string }) => client.name === `${prefix} Cliente`,
    )?.id;
    expect(clientId).toMatch(/^[0-9a-f-]{36}$/);
  });

  await test.step('caneca branca e produto personalizados cadastrados na interface', async () => {
    await page.goto('/app/produtos/novo');
    await page.getByLabel('Nome', { exact: true }).fill(`${prefix} Caneca branca`);
    await page.getByLabel('Unidade').fill('UN');
    await page.getByLabel('Custo direto opcional').fill('8.5');
    await page.getByRole('button', { name: 'Salvar item' }).click();
    await expect(page).toHaveURL(/\/app\/produtos$/);
    await page.goto('/app/produtos/novo');
    await page.getByLabel('Nome', { exact: true }).fill(`${prefix} Caneca personalizada`);
    await page.getByLabel('Unidade').fill('UN');
    await page.getByRole('button', { name: 'Salvar item' }).click();
    await expect(page).toHaveURL(/\/app\/produtos$/);
  });

  await test.step('configuração e perfil pela interface', async () => {
    await page.goto('/app/produtos/precificacao/configuracao');
    await page.getByRole('button', { name: 'Criar configuração' }).click();
    await page.getByLabel('Tratamento dos custos fixos').selectOption('RATE');
    await page.getByLabel('Custos fixos', { exact: true }).fill('10');
    await page.getByLabel('Custo mensal de mão de obra').fill('2400');
    await page.getByLabel('Horas produtivas mensais').fill('160');
    await page.getByLabel('Margem desejada padrão').fill('25');
    await page.getByRole('button', { name: 'Criar configuração' }).click();
    await expect(page.getByText('Configuração inicial criada.')).toBeVisible();

    await page.goto('/app/produtos/precificacao/perfis');
    await page.getByRole('button', { name: 'Criar perfil', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill(`${prefix} Venda direta`);
    await page.getByRole('button', { name: 'Criar perfil' }).click();
    await expect(page).toHaveURL(/\/app\/produtos\/precificacao\/perfis\/[0-9a-f-]+$/);
  });

  await test.step('composição, simulação, versão, adoção e preço manual', async () => {
    await page.goto('/app/produtos');
    await page.getByLabel('Buscar produtos e serviços').fill(`${prefix} Caneca personalizada`);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('button', { name: `${prefix} Caneca personalizada` }).click();
    await page.getByRole('link', { name: 'Abrir área de precificação' }).click();
    productId = new URL(page.url()).pathname.split('/')[3];
    expect(productId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Precificação do produto' })).toBeVisible();
    await page.getByLabel('Perfil de venda').selectOption({ label: `${prefix} Venda direta` });
    await page.getByLabel('Considerar tempo de mão de obra').check();
    await page.getByLabel('Tempo (minutos)').fill('5');
    await page.getByRole('button', { name: 'Adicionar componente' }).click();
    await page.getByLabel('Nome', { exact: true }).last().fill('Caneca branca');
    await page.getByLabel('Quantidade').fill('1');
    await page.getByLabel('Origem do custo').selectOption('CATALOG');
    await page
      .getByLabel('Produto do catálogo')
      .selectOption({ label: `${prefix} Caneca branca (UN)` });
    await page.getByRole('button', { name: 'Criar composição' }).click();
    await expect(page.getByText(/Revisão atual:/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar simulação no servidor' }).click();
    await expect(
      page.getByText('Cálculo confirmado pelo servidor e idêntico à prévia local.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Salvar versão' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Versão nº 1 criada/ })).toBeVisible();
    await page.getByRole('button', { name: 'Adotar versão 1' }).click();
    await page
      .getByRole('dialog', { name: 'Adotar versão 1' })
      .getByRole('button', { name: 'Confirmar adoção' })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Adotar versão 1' }).getByRole('status'),
    ).toContainText('vinculado');
    await page
      .getByRole('dialog', { name: 'Adotar versão 1' })
      .getByRole('button', { name: 'Fechar' })
      .click();
    await expect(page.getByText('Preço atual originado desta versão').first()).toBeVisible();
    const versions = await page.request.get(
      `${process.env.PILOT_API_URL}/api/pricing/products/${productId}/versions`,
    );
    expect(versions.status()).toBe(200);
    const version = (await versions.json()).data[0];
    adoptedVersionId = version.id;
    adoptedPrice = version.analyzedPrice;
  });

  await test.step('troca de versão com o mesmo preço invalida a confirmação anterior', async () => {
    const observed = await page.request.get(
      `${process.env.PILOT_API_URL}/api/products/${productId}`,
    );
    expect(observed.status()).toBe(200);
    const product = await observed.json();
    expect(product.adoptedPricingVersionId).toBe(adoptedVersionId);
    await page.getByRole('button', { name: 'Confirmar simulação no servidor' }).click();
    await expect(
      page.getByText('Cálculo confirmado pelo servidor e idêntico à prévia local.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Salvar versão' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Versão nº 2 criada/ })).toBeVisible();
    await page.getByRole('button', { name: 'Adotar versão 2' }).click();
    await page
      .getByRole('dialog', { name: 'Adotar versão 2' })
      .getByRole('button', { name: 'Confirmar adoção' })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Adotar versão 2' }).getByRole('status'),
    ).toContainText('vinculado');
    await page
      .getByRole('dialog', { name: 'Adotar versão 2' })
      .getByRole('button', { name: 'Fechar' })
      .click();
    const versions = await page.request.get(
      `${process.env.PILOT_API_URL}/api/pricing/products/${productId}/versions`,
    );
    expect(versions.status()).toBe(200);
    const latest = (await versions.json()).data[0];
    expect(latest.id).not.toBe(adoptedVersionId);
    expect(latest.analyzedPrice).toBe(adoptedPrice);
    const stale = await page.request.post(`${process.env.PILOT_API_URL}/api/quotes`, {
      data: {
        clientId,
        items: [
          {
            productId,
            description: product.name,
            unit: product.unit,
            quantity: '1',
            unitPrice: adoptedPrice,
            priceSelection: 'CATALOG_NOW',
            expectedProductUpdatedAt: product.updatedAt,
            expectedAdoptedPricingVersionId: adoptedVersionId,
          },
        ],
      },
    });
    expect(stale.status()).toBe(409);
    adoptedVersionId = latest.id;
  });

  await test.step('orçamento e pedido congelam preço e origem adotados', async () => {
    await page.goto('/app/financeiro/orcamentos/novo');
    await page.getByLabel('Cliente').selectOption({ label: `${prefix} Cliente` });
    await page
      .getByLabel('Item do catálogo opcional')
      .selectOption({ label: `${prefix} Caneca personalizada — UN` });
    await expect(page.getByLabel('Origem do preço')).toHaveValue('CATALOG_NOW');
    await expect(page.getByLabel('Preço unitário')).toHaveValue(canonicalDecimal(adoptedPrice));
    await page.getByRole('button', { name: 'Salvar orçamento' }).click();
    await expect(page).toHaveURL(/\/app\/financeiro\/orcamentos$/);
    await page.getByRole('button', { name: 'Orçamento #1' }).click();
    quoteId = new URL(page.url()).pathname.split('/').at(-1) ?? '';
    await expect(page.getByText('Preço do produto com versão adotada na criação')).toBeVisible();
    await page.getByRole('button', { name: 'Enviar orçamento' }).click();
    await page.getByRole('button', { name: 'Aprovar orçamento' }).click();
    await page.getByRole('button', { name: 'Criar pedido' }).click();
    await expect(page).toHaveURL(/\/app\/financeiro\/pedidos\/[0-9a-f-]+$/);
    orderId = new URL(page.url()).pathname.split('/').at(-1) ?? '';
    await expect(page.getByText('Preço do produto com versão adotada no orçamento')).toBeVisible();
    const quoteResponse = await page.request.get(
      `${process.env.PILOT_API_URL}/api/quotes/${quoteId}`,
    );
    const orderResponse = await page.request.get(
      `${process.env.PILOT_API_URL}/api/orders/${orderId}`,
    );
    expect(quoteResponse.status()).toBe(200);
    expect(orderResponse.status()).toBe(200);
    const quoteItem = (await quoteResponse.json()).items[0];
    const orderItem = (await orderResponse.json()).items[0];
    expect(quoteItem).toMatchObject({
      unitPrice: canonicalDecimal(adoptedPrice),
      priceOrigin: 'CATALOG',
      pricingVersionId: adoptedVersionId,
    });
    expect(orderItem).toMatchObject({
      unitPrice: canonicalDecimal(adoptedPrice),
      priceOrigin: 'CATALOG',
      pricingVersionId: adoptedVersionId,
    });
    expect(JSON.stringify(quoteItem)).not.toMatch(/directCost|margin|deductions|snapshot/i);
    expect(JSON.stringify(orderItem)).not.toMatch(/directCost|margin|deductions|snapshot/i);
  });

  await test.step('preço manual posterior não altera orçamento nem pedido', async () => {
    await page.goto(`/app/produtos/${productId}/precificacao`);
    await page.getByRole('button', { name: 'Definir preço manual' }).click();
    await page
      .getByRole('dialog', { name: 'Definir preço manual' })
      .getByLabel('Preço de venda')
      .fill(canonicalDecimal(adoptedPrice));
    await page
      .getByRole('dialog', { name: 'Definir preço manual' })
      .getByRole('button', { name: 'Confirmar preço' })
      .click();
    await expect(
      page
        .getByRole('dialog', { name: 'Definir preço manual' })
        .getByText('Preço manual atualizado.'),
    ).toBeVisible();
    await page
      .getByRole('dialog', { name: 'Definir preço manual' })
      .getByRole('button', { name: 'Cancelar' })
      .click();
    await expect(page.getByText('Não adotada atualmente').first()).toBeVisible();
    const currentProduct = await page.request.get(
      `${process.env.PILOT_API_URL}/api/products/${productId}`,
    );
    expect(currentProduct.status()).toBe(200);
    expect(await currentProduct.json()).toMatchObject({
      salePrice: canonicalDecimal(adoptedPrice),
      adoptedPricingVersionId: null,
    });
    for (const [path, label] of [
      [`quotes/${quoteId}`, 'quote'],
      [`orders/${orderId}`, 'order'],
    ] as const) {
      const response = await page.request.get(`${process.env.PILOT_API_URL}/api/${path}`);
      expect(response.status(), label).toBe(200);
      expect((await response.json()).items[0]).toMatchObject({
        unitPrice: canonicalDecimal(adoptedPrice),
        priceOrigin: 'CATALOG',
        pricingVersionId: adoptedVersionId,
      });
    }
  });

  await test.step('papéis internos e isolamento da organização', async () => {
    const fixturePath = fileURLToPath(
      new URL('../../../api/test/pilot-role-fixtures.cjs', import.meta.url),
    );
    const fixture = spawnSync('node', [fixturePath], {
      input: JSON.stringify({ ownerEmail, password, suffix: runId }),
      env: process.env,
      encoding: 'utf8',
    });
    expect(fixture.status, fixture.stderr).toBe(0);
    expect(fixture.stdout).toContain('ROLE_FIXTURES_READY');

    for (const role of ['FINANCE', 'VIEWER'] as const) {
      const context = await browser.newContext({ baseURL: process.env.PILOT_WEB_URL });
      try {
        const rolePage = await context.newPage();
        rolePage.on('pageerror', (error) => browserErrors.push(`${role}: ${error.name}`));
        rolePage.on('response', (response) => {
          if (response.url().includes('/api/') && response.status() >= 500) {
            browserErrors.push(`${role}: HTTP ${response.status()}`);
          }
        });
        const internalRequests: string[] = [];
        rolePage.on('request', (request) => {
          if (
            /\/api\/pricing\/(?:configuration|profiles|products\/[^/]+\/(?:composition|versions|simulations))/.test(
              request.url(),
            )
          ) {
            internalRequests.push(request.url());
          }
        });
        await rolePage.goto('/login');
        await rolePage.getByLabel('E-mail').fill(`${role.toLowerCase()}-${runId}@example.invalid`);
        await rolePage.getByLabel('Senha').fill(password);
        await rolePage.getByRole('button', { name: 'Entrar', exact: true }).click();
        await expect(rolePage).toHaveURL(/\/app\/?$/);
        await rolePage.goto(`/app/produtos/${productId}/precificacao`);
        await expect(
          rolePage.getByRole('heading', { name: 'Precificação do produto' }),
        ).toBeVisible();
        if (role === 'FINANCE') {
          await expect(rolePage.getByText('Histórico de versões')).toBeVisible();
          await expect(rolePage.getByRole('button', { name: 'Salvar versão' })).toHaveCount(0);
          await expect(rolePage.getByRole('button', { name: 'Adotar versão 1' })).toHaveCount(0);
          await expect(
            rolePage.getByRole('button', { name: 'Confirmar simulação no servidor' }),
          ).toHaveCount(0);
          expect(
            (
              await context.request.post(
                `${process.env.PILOT_API_URL}/api/pricing/products/${productId}/adoptions`,
                { data: { versionId: randomUUID() } },
              )
            ).status(),
          ).toBe(403);
        } else {
          await expect(rolePage.getByText('Histórico de versões')).toHaveCount(0);
          await expect(rolePage.getByText('Resumo comercial', { exact: true })).toBeVisible();
          expect(internalRequests).toHaveLength(0);
          expect(
            (
              await context.request.get(
                `${process.env.PILOT_API_URL}/api/pricing/products/${productId}/versions`,
              )
            ).status(),
          ).toBe(403);
        }
      } finally {
        await context.close();
      }
    }

    const foreign = await browser.newContext();
    try {
      const registration = await foreign.request.post(
        `${process.env.PILOT_API_URL}/api/auth/register`,
        {
          data: {
            name: 'Outro proprietário fictício',
            email: `other-${runId}@example.invalid`,
            password,
            organizationName: `Outra organização fictícia ${runId}`,
          },
        },
      );
      expect(registration.status()).toBe(201);
      const isolated = await foreign.request.get(
        `${process.env.PILOT_API_URL}/api/pricing/products/${productId}/versions`,
      );
      expect(isolated.status()).toBe(404);
    } finally {
      await foreign.close();
    }
  });

  await test.step('larguras 360, 768 e 1280 px; teclado e foco', async () => {
    await page.getByRole('button', { name: 'Ver detalhe da versão 1' }).click();
    const detail = page.getByRole('dialog', { name: 'Detalhe histórico da versão' });
    await expect(detail).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(detail).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ver detalhe da versão 1' })).toBeFocused();

    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.getByRole('heading', { name: 'Precificação do produto' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `Horizontal page overflow at ${width}px`).toBe(false);
      const valueOverflow = await page
        .locator('dd')
        .evaluateAll((values) => values.some((value) => value.scrollWidth > value.clientWidth + 1));
      expect(valueOverflow, `Truncated result value at ${width}px`).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`pricing-${width}.png`), fullPage: true });
    }
  });

  expect(writes).toContainEqual(
    expect.stringMatching(/^POST \/api\/pricing\/products\/[^/]+\/simulations$/),
  );
  expect(writes).toContainEqual(
    expect.stringMatching(/^POST \/api\/pricing\/products\/[^/]+\/versions$/),
  );
  expect(writes).toContainEqual(
    expect.stringMatching(/^POST \/api\/pricing\/products\/[^/]+\/adoptions$/),
  );
  expect(browserErrors).toEqual([]);
});

test('convite exige aceite e seleção explícita com contas separadas', async ({ page, browser }) => {
  const runId = randomBytes(5).toString('hex');
  const ownerEmail = `owner-${runId}@example.invalid`;
  const invitedEmail = `admin-${runId}@example.invalid`;
  const newEmail = `new-${runId}@example.invalid`;
  const password = `Pilot-${runId}-Pass!`;
  const organizationName = `Casa Nacoli fictícia ${runId}`;
  const otherOrganizationName = `Outra empresa fictícia ${runId}`;

  async function register(
    currentPage: typeof page,
    name: string,
    email: string,
    organization: string,
  ) {
    await currentPage.goto('/cadastro');
    await currentPage.getByLabel('Nome completo').fill(name);
    await currentPage.getByLabel('E-mail').fill(email);
    await currentPage.getByLabel('Senha', { exact: true }).fill(password);
    await currentPage.getByLabel('Confirme a senha').fill(password);
    await currentPage.getByLabel('Nome da empresa').fill(organization);
    await currentPage.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(currentPage).toHaveURL(/\/app\/?$/);
  }

  await register(page, 'Proprietário fictício', ownerEmail, organizationName);
  const ownerSession = await page.context().request.get(`${process.env.PILOT_API_URL}/api/auth/me`);
  const ownerOrganizationId = (await ownerSession.json()).organization.id;
  await page.goto('/app/membros');
  await page.getByLabel('E-mail do destinatário').fill(invitedEmail);
  await page.getByLabel('Papel').selectOption('ADMIN');
  await page.getByRole('button', { name: 'Criar convite' }).click();
  const link = await page.getByLabel('Link do convite').inputValue();
  expect(link).toMatch(/\/convites\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole('listitem').filter({ hasText: invitedEmail })).toBeVisible();

  const existing = await browser.newContext({ baseURL: process.env.PILOT_WEB_URL });
  try {
    const invited = await existing.newPage();
    await register(invited, 'Admin fictícia', invitedEmail, otherOrganizationName);
    await invited.goto(link);
    await expect(invited.getByRole('button', { name: 'Aceitar convite' })).toBeVisible();
    await invited.getByRole('button', { name: 'Aceitar convite' }).click();
    await expect(invited.getByText('Convite aceito. Seu vínculo foi criado.')).toBeVisible();
    await invited.getByRole('link', { name: 'Selecionar organização' }).click();
    await expect(invited.getByRole('button', { name: new RegExp(organizationName) })).toBeVisible();
    await invited.getByRole('button', { name: new RegExp(organizationName) }).click();
    await expect(invited).toHaveURL(/\/app\/?$/);
    await expect(invited.getByText(organizationName, { exact: true })).toBeVisible();
    await invited.goto('/app/produtos/precificacao/perfis');
    await invited.getByRole('button', { name: 'Criar perfil', exact: true }).click();
    await invited.getByLabel('Nome', { exact: true }).fill(`Rascunho ${runId}`);
    await invited.getByRole('link', { name: 'Trocar organização' }).click();
    const discard = invited.getByRole('dialog', { name: 'Descartar alterações não salvas?' });
    await expect(discard).toBeVisible();
    await discard.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(invited.getByLabel('Nome', { exact: true })).toHaveValue(`Rascunho ${runId}`);
    await invited.getByRole('link', { name: 'Trocar organização' }).click();
    await discard.getByRole('button', { name: 'Descartar e sair' }).click();
    await expect(invited).toHaveURL(/\/selecionar-organizacao$/);
    await invited.getByRole('button', { name: new RegExp(organizationName) }).click();
    await expect(invited).toHaveURL(/\/app\/?$/);
    await invited.goto('/app/membros');
    await expect(
      invited.getByText('Apenas o proprietário pode administrar convites.'),
    ).toBeVisible();

    const secondTab = await existing.newPage();
    await secondTab.goto('/app');
    await expect(secondTab.getByText(organizationName, { exact: true })).toBeVisible();
    const delayedClientName = `Leitura antiga ${runId}`;
    const createdClient = await page
      .context()
      .request.post(`${process.env.PILOT_API_URL}/api/clients`, {
        data: { name: delayedClientName },
      });
    expect(createdClient.status()).toBe(201);
    let releaseRead: (() => void) | undefined;
    let markFetched: (() => void) | undefined;
    const readFetched = new Promise<void>((resolve) => (markFetched = resolve));
    const readGate = new Promise<void>((resolve) => (releaseRead = resolve));
    await secondTab.route('**/api/clients**', async (route) => {
      const response = await route.fetch();
      markFetched?.();
      await readGate;
      await route.fulfill({ response }).catch(() => undefined);
    });
    const oldReadNavigation = secondTab.goto('/app/clientes').catch(() => null);
    await readFetched;
    await invited.getByRole('link', { name: 'Trocar organização' }).click();
    await invited.getByRole('button', { name: new RegExp(otherOrganizationName) }).click();
    await expect(invited).toHaveURL(/\/app\/?$/);
    await expect(invited.getByText(otherOrganizationName, { exact: true })).toBeVisible();
    releaseRead?.();
    await oldReadNavigation;
    await expect(secondTab.getByText(otherOrganizationName, { exact: true })).toBeVisible();
    await expect(secondTab.getByText(delayedClientName)).toHaveCount(0);
    await secondTab.unroute('**/api/clients**');
    const staleContext = await existing.request.post(
      `${process.env.PILOT_API_URL}/api/organization/invitations`,
      {
        headers: { 'X-Organization-Context': ownerOrganizationId },
        data: { email: `stale-${runId}@example.invalid`, role: 'ADMIN' },
      },
    );
    expect(staleContext.status()).toBe(409);
    await invited.getByRole('link', { name: 'Trocar organização' }).click();
    await invited.getByRole('button', { name: new RegExp(organizationName) }).click();
    await expect(invited.getByText(organizationName, { exact: true })).toBeVisible();
    await expect(secondTab.getByText(organizationName, { exact: true })).toBeVisible();
    const staleSameOrganization = await existing.request.post(
      `${process.env.PILOT_API_URL}/api/clients`,
      {
        headers: {
          'X-Organization-Context': ownerOrganizationId,
          'X-Organization-Context-Version': '1',
        },
        data: { name: `Escrita antiga ${runId}` },
      },
    );
    expect(staleSameOrganization.status()).toBe(409);
    const activeContext = await existing.request.get(`${process.env.PILOT_API_URL}/api/auth/me`);
    const activeVersion = (await activeContext.json()).contextVersion as number;
    let releaseMutation: (() => void) | undefined;
    let markCommitted: (() => void) | undefined;
    let markDelivered: (() => void) | undefined;
    const mutationCommitted = new Promise<void>((resolve) => (markCommitted = resolve));
    const mutationDelivered = new Promise<void>((resolve) => (markDelivered = resolve));
    const mutationGate = new Promise<void>((resolve) => (releaseMutation = resolve));
    await secondTab.route('**/api/clients', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      markCommitted?.();
      await mutationGate;
      await route.fulfill({ response }).catch(() => undefined);
      markDelivered?.();
    });
    const pendingClientName = `Mutação anterior ${runId}`;
    await secondTab.evaluate(
      ({ apiUrl, organizationId, contextVersion, name }) => {
        void fetch(`${apiUrl}/api/clients`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Organization-Context': organizationId,
            'X-Organization-Context-Version': String(contextVersion),
          },
          body: JSON.stringify({ name }),
        }).catch(() => undefined);
      },
      {
        apiUrl: process.env.PILOT_API_URL!,
        organizationId: ownerOrganizationId,
        contextVersion: activeVersion,
        name: pendingClientName,
      },
    );
    await mutationCommitted;
    await invited.getByRole('link', { name: 'Trocar organização' }).click();
    await invited.getByRole('button', { name: new RegExp(otherOrganizationName) }).click();
    releaseMutation?.();
    await mutationDelivered;
    await expect(secondTab.getByText(otherOrganizationName, { exact: true })).toBeVisible();
    const otherClients = await existing.request.get(`${process.env.PILOT_API_URL}/api/clients`);
    expect(JSON.stringify((await otherClients.json()).data)).not.toContain(pendingClientName);
    const originalClients = await page
      .context()
      .request.get(`${process.env.PILOT_API_URL}/api/clients`);
    expect(JSON.stringify((await originalClients.json()).data)).toContain(pendingClientName);
    await secondTab.unroute('**/api/clients');
    const ownerStillActive = await page
      .context()
      .request.get(`${process.env.PILOT_API_URL}/api/auth/me`);
    expect((await ownerStillActive.json()).organization.id).toBe(ownerOrganizationId);
    await secondTab.close();

    await invited.goto('/login');
    await invited.getByLabel('E-mail').fill(invitedEmail);
    await invited.getByLabel('Senha').fill(password);
    await invited.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(invited).toHaveURL(/\/selecionar-organizacao$/);
  } finally {
    await existing.close();
  }

  await page.getByLabel('E-mail do destinatário').fill(newEmail);
  await page.getByRole('button', { name: 'Criar convite' }).click();
  const newLink = await page.getByLabel('Link do convite').inputValue();
  const fresh = await browser.newContext({ baseURL: process.env.PILOT_WEB_URL });
  try {
    const recipient = await fresh.newPage();
    await recipient.goto(newLink);
    await expect(recipient.getByRole('button', { name: 'Criar conta' })).toBeVisible();
    await recipient.getByLabel('Nome').fill('Nova pessoa fictícia');
    await recipient.getByLabel('E-mail').fill(newEmail);
    await recipient.getByLabel('Senha').fill(password);
    await recipient.getByRole('button', { name: 'Criar conta' }).click();
    await expect(recipient.getByRole('button', { name: 'Aceitar convite' })).toBeVisible();
    const before = await fresh.request.get(`${process.env.PILOT_API_URL}/api/auth/me`);
    expect((await before.json()).organizations).toEqual([]);
    expect((await fresh.request.get(`${process.env.PILOT_API_URL}/api/clients`)).status()).toBe(
      401,
    );
    await recipient.getByRole('button', { name: 'Aceitar convite' }).click();
    await expect(recipient.getByText('Convite aceito. Seu vínculo foi criado.')).toBeVisible();
  } finally {
    await fresh.close();
  }

  const revocableEmail = `revoke-${runId}@example.invalid`;
  await page.getByLabel('E-mail do destinatário').fill(revocableEmail);
  await page.getByRole('button', { name: 'Criar convite' }).click();
  const revocableLink = await page.getByLabel('Link do convite').inputValue();
  await page.getByRole('button', { name: `Revogar convite de ${revocableEmail}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Revogar convite' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: revocableEmail })).toContainText(
    'PENDING',
  );
  await page.getByRole('button', { name: `Revogar convite de ${revocableEmail}` }).click();
  await dialog.getByRole('button', { name: 'Confirmar revogação' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: revocableEmail })).toContainText(
    'REVOKED',
  );
  await expect(page.getByLabel('Link do convite')).toHaveCount(0);
  const revokedToken = new URL(revocableLink).pathname.split('/').pop();
  const revokedInfo = await page
    .context()
    .request.get(`${process.env.PILOT_API_URL}/api/auth/invitations/${revokedToken}`);
  expect((await revokedInfo.json()).status).toBe('REVOKED');
});
