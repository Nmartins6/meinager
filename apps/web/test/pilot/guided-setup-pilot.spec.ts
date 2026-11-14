import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('cadastro guiado local persiste custos, insumo, produto precificado e cliente', async ({
  page,
}) => {
  const suffix = randomBytes(5).toString('hex');
  await page.goto('/cadastro');
  await page.getByLabel('Nome completo').fill('Operador fictício');
  await page.getByLabel('E-mail').fill(`guided-${suffix}@example.invalid`);
  await page.getByLabel('Senha', { exact: true }).fill(`Pilot-${suffix}-Pass!`);
  await page.getByLabel('Confirme a senha').fill(`Pilot-${suffix}-Pass!`);
  await page.getByLabel('Nome da empresa').fill(`Setup fictício ${suffix}`);
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page).toHaveURL(/\/app\/?$/);
  await page.goto('/app/cadastro-guiado');

  const fixed = page.locator('#custos-fixos');
  await fixed.getByLabel('Mês', { exact: true }).selectOption('11');
  await fixed.getByLabel('Ano', { exact: true }).fill('2026');
  await fixed.getByRole('button', { name: 'Criar competência' }).click();
  await fixed.getByLabel('Nova categoria de custo fixo').fill('Aluguel fictício');
  await fixed.getByRole('button', { name: 'Cadastrar categoria' }).click();
  await expect(fixed.getByRole('status')).toContainText('criada');
  await fixed.getByLabel('Descrição', { exact: true }).fill('Aluguel novembro');
  await fixed.getByLabel('Valor da despesa').fill('100');
  await fixed.getByLabel('Vencimento').fill('2026-11-15');
  await fixed.getByRole('button', { name: 'Registrar despesa' }).click();
  await expect(fixed.getByRole('status')).toContainText('Despesa registrada');

  const variable = page.locator('#custos-variaveis');
  await variable.getByLabel('Competência', { exact: true }).selectOption({ label: '11/2026' });
  await variable.getByLabel('Nova categoria de custo variável').fill('Despesa variável fictícia');
  await variable.getByRole('button', { name: 'Cadastrar categoria' }).click();
  await expect(variable.getByRole('status')).toContainText('criada');
  await variable.getByLabel('Descrição', { exact: true }).fill('Despesa novembro');
  await variable.getByLabel('Valor da despesa').fill('20');
  await variable.getByLabel('Vencimento').fill('2026-11-16');
  await variable.getByRole('button', { name: 'Registrar despesa' }).click();
  await expect(variable.getByRole('status')).toContainText('Despesa registrada');

  const rules = page.locator('#regras-preco');
  await rules.getByLabel('Tratamento dos custos fixos').selectOption('RATE');
  await rules.getByLabel('Custos fixos', { exact: true }).fill('10');
  await rules.getByLabel('Margem desejada padrão').fill('25');
  await rules.getByRole('button', { name: 'Criar configuração' }).click();
  await expect(rules.getByText('Configuração inicial criada.')).toBeVisible();

  const supplies = page.locator('#insumos');
  await supplies.getByLabel('Nome', { exact: true }).fill(`Insumo ${suffix}`);
  await supplies.getByLabel(/Custo/).fill('10');
  await supplies.getByRole('button', { name: 'Cadastrar insumo' }).click();
  await expect(supplies.getByRole('status')).toContainText('cadastrado');

  const product = page.locator('#produto');
  await product.getByLabel('Nome', { exact: true }).fill(`Produto ${suffix}`);
  await product.getByRole('button', { name: 'Cadastrar produto' }).click();
  await expect(product.getByText(/Monte a composição abaixo/)).toBeVisible();
  await product.getByRole('button', { name: 'Adicionar componente' }).click();
  await product.getByLabel('Nome', { exact: true }).fill('Material');
  await product.getByLabel('Quantidade', { exact: true }).fill('1');
  await product.getByLabel('Origem do custo').selectOption('CATALOG');
  await product.getByLabel('Produto do catálogo').selectOption({ label: `Insumo ${suffix} (UN)` });
  await product.getByRole('button', { name: 'Criar composição' }).click();
  await expect(product.getByText(/Revisão atual:/)).toBeVisible();
  await product.getByRole('button', { name: 'Confirmar simulação no servidor' }).click();
  await expect(
    product.getByText('Cálculo confirmado pelo servidor e idêntico à prévia local.'),
  ).toBeVisible();
  await product.getByRole('button', { name: 'Salvar versão' }).click();
  await expect(product.getByText(/Versão nº 1 criada/)).toBeVisible();
  await product.getByRole('button', { name: 'Adotar versão 1' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adotar versão 1' });
  await dialog.getByRole('button', { name: 'Confirmar adoção' }).click();
  await expect(dialog.getByRole('status')).toContainText('vinculado');
  await dialog.getByRole('button', { name: 'Fechar' }).click();

  const clients = page.locator('#clientes');
  await clients.getByLabel('Nome', { exact: true }).fill(`Cliente ${suffix}`);
  await clients.getByRole('button', { name: 'Cadastrar cliente' }).click();
  await expect(clients.getByRole('status')).toContainText('cadastrado');
  await clients.getByRole('link', { name: 'Criar orçamento' }).click();
  await expect(page).toHaveURL(/\/app\/financeiro\/orcamentos\/novo$/);

  await page.goto('/app/produtos');
  await page.getByLabel('Buscar produtos e serviços').fill(`Produto ${suffix}`);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: `Produto ${suffix}` }).click();
  // 10 / (1 - 10% - 25%), rounded upwards to the commercial cent.
  await expect(page.getByText(/15,39/).first()).toBeVisible();
});
