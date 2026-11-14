import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('cadastro guiado local: exploração de validação, recuperação e tela pequena', async ({
  page,
}) => {
  const suffix = randomBytes(5).toString('hex');
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (/blocker|duplicate|unique/i.test(message.text())) warnings.push(message.text());
  });
  await page.goto('/cadastro');
  await page.getByLabel('Nome completo').fill('Explorador fictício');
  await page.getByLabel('E-mail').fill(`explore-${suffix}@example.invalid`);
  await page.getByLabel('Senha', { exact: true }).fill(`Pilot-${suffix}-Pass!`);
  await page.getByLabel('Confirme a senha').fill(`Pilot-${suffix}-Pass!`);
  await page.getByLabel('Nome da empresa').fill(`Exploração ${suffix}`);
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page).toHaveURL(/\/app\/?$/);
  const invalidContact = await page.request.post(`${process.env.PILOT_API_URL}/api/clients`, {
    data: { name: 'Contato inválido fictício', document: 'abc', phone: 'abc' },
  });
  expect(invalidContact.status()).toBe(400);
  await page.goto('/app/cadastro-guiado');

  const clients = page.locator('#clientes');
  await clients.getByRole('button', { name: 'Cadastrar cliente' }).click();
  await expect(clients.getByLabel('Nome', { exact: true })).toBeFocused();
  await clients.getByLabel('Nome', { exact: true }).fill(`Cliente ${suffix}`);
  await clients.getByLabel('CPF ou CNPJ').fill('abc');
  await clients.getByLabel('Telefone ou WhatsApp').fill('abc');
  await clients.getByRole('button', { name: 'Cadastrar cliente' }).click();
  await expect(clients.getByLabel('CPF ou CNPJ')).toHaveAccessibleDescription(
    'Informe um CPF ou CNPJ com 11 ou 14 dígitos.',
  );
  await expect(clients.getByLabel('CPF ou CNPJ')).toBeFocused();
  await expect(clients.getByLabel('Telefone ou WhatsApp')).toHaveAccessibleDescription(
    'Informe um telefone com 10 a 13 dígitos.',
  );

  const supplies = page.locator('#insumos');
  await supplies.getByLabel('Nome', { exact: true }).fill(`Material ${suffix}`);
  await supplies.getByLabel(/Custo/).fill('12.50');
  await page.route('**/api/products', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Falha temporária de teste' }),
      });
    } else await route.continue();
  });
  await supplies.getByRole('button', { name: 'Cadastrar insumo' }).click();
  await expect(supplies.getByRole('alert')).toBeVisible();
  await expect(supplies.getByLabel('Nome', { exact: true })).toHaveValue(`Material ${suffix}`);
  await page.unroute('**/api/products');
  await supplies.getByRole('button', { name: 'Cadastrar insumo' }).click();
  await expect(supplies.getByRole('status')).toContainText('cadastrado');

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .locator('[id]')
      .evaluateAll((nodes) =>
        nodes.map((n) => n.id).filter((id, index, ids) => ids.indexOf(id) !== index),
      ),
  ).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('guided-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#regras-preco').getByLabel('Margem desejada padrão').fill('27');
  await page.getByRole('button', { name: 'Cadastrar perfil de venda' }).click();
  await clients.getByRole('link', { name: 'Criar orçamento' }).click();
  const dialog = page.getByRole('dialog', { name: 'Descartar alterações não salvas?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page.locator('#regras-preco').getByLabel('Margem desejada padrão')).toHaveValue(
    '27',
  );
  await clients.getByRole('link', { name: 'Criar orçamento' }).click();
  await dialog.getByRole('button', { name: 'Descartar e sair' }).click();
  await expect(page).toHaveURL(/\/orcamentos\/novo$/);
  expect(warnings).toEqual([]);
});
