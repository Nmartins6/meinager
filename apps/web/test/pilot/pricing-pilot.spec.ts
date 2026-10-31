import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

test('percursos fictícios de precificação usam API e PostgreSQL descartável', async ({
  page,
  browser,
}, testInfo) => {
  const runId = randomBytes(5).toString('hex');
  const prefix = `PILOTO FICTÍCIO ${runId}`;
  const ownerEmail = `nicolas-${runId}@example.invalid`;
  const password = `Pilot-${runId}-Pass!`;
  let productId = '';
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
    await page.getByRole('button', { name: 'Definir preço manual' }).click();
    await page
      .getByRole('dialog', { name: 'Definir preço manual' })
      .getByLabel('Preço de venda')
      .fill('99.00');
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
    await expect(page.getByText('Não adotada atualmente')).toBeVisible();
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
