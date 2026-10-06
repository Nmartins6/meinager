# Domínio de precificação

## Objetivo

O domínio de precificação do Meinager será responsável por calcular,
explicar, versionar e aplicar preços sugeridos para produtos e serviços.

A precificação deve considerar custos diretos, mão de obra, embalagem,
frete, custos fixos, impostos, taxas de venda, comissões e margem de lucro,
conforme os componentes utilizados por cada organização.

O preço calculado é uma sugestão. O usuário poderá adotar um preço diferente,
mas o sistema deverá apresentar os impactos dessa decisão sobre lucro e margem.

## Princípios

O domínio deve seguir estes princípios:

1. Nenhum valor financeiro ou percentual de exemplo deve ser fixado como regra
   global do sistema.
2. Cada organização deve utilizar somente seus próprios parâmetros,
   composições e históricos.
3. Cálculos monetários devem utilizar representação decimal apropriada.
4. O resultado deve explicar como o preço foi formado.
5. Alterações futuras nos parâmetros não podem modificar cálculos históricos.
6. Orçamentos e pedidos devem preservar os valores utilizados no momento de
   sua criação.
7. O preço sugerido e o preço efetivamente adotado devem ser armazenados
   separadamente.
8. O motor matemático deve ser independente da interface e da persistência.
9. Componentes opcionais ausentes devem assumir valor zero sem exigir motores
   de cálculo separados.
10. Regras de precificação não podem quebrar os módulos existentes de produtos,
    estoque, financeiro, orçamentos e pedidos.

## Documentos oficiais

Os documentos oficiais deste domínio são:

- [`business-rules.md`](business-rules.md): regras de negócio e comportamentos
  obrigatórios.
- [`calculation-specification.md`](calculation-specification.md): fórmulas,
  unidades, precisão e arredondamento.
- [`acceptance-criteria.md`](acceptance-criteria.md): comportamentos verificáveis
  e critérios de conclusão.
- [`examples.md`](examples.md): exemplos matemáticos canônicos e cenários
  inválidos.
- [ADR-006 — Persistência de precificação](../../architecture/decisions/ADR-006-pricing-persistence-model.md):
  modelo persistente, invariantes e histórico.
- [ADR-007 — Contrato e segurança da API](../../architecture/decisions/ADR-007-pricing-api-contract.md):
  endpoints, autorização, snapshot v1, erros e concorrência do Marco 3.

Quando houver divergência entre esses documentos e materiais preliminares,
prevalecem os documentos oficiais, observadas as decisões arquiteturais
registradas em `docs/architecture/decisions/`.

## Material de origem

Os levantamentos iniciais estão preservados em:

- [`../../product/sources/pricing-requirements-original.md`](../../product/sources/pricing-requirements-original.md)

Esse material serve como referência histórica e não deve ser aplicado
diretamente no código sem validação nas regras oficiais.

## Relação com outros domínios

### Produtos

O produto ou serviço poderá possuir uma composição de custos e várias versões
de cálculo. O preço comercial adotado continuará pertencendo ao produto.

### Estoque

Insumos cadastrados como produtos poderão participar da composição de outro
produto. O cálculo deverá utilizar um custo de referência registrado no
snapshot, sem alterar retroativamente cálculos anteriores.

### Financeiro

O módulo financeiro poderá fornecer valores consolidados para custos fixos,
faturamento médio e comparação entre custos estimados e realizados.

A precificação não deverá alterar lançamentos financeiros automaticamente sem
uma regra específica e auditável.

### Orçamentos

Ao adicionar um produto a um orçamento, os dados comerciais e financeiros
necessários deverão ser copiados como snapshot.

### Pedidos

O pedido deverá preservar os snapshots herdados do orçamento. Mudanças no
produto ou na configuração de precificação não poderão alterar pedidos
existentes.

## Situação atual

A estrutura funcional de produtos, estoque, financeiro, clientes, orçamentos,
pedidos e fluxos de pedidos já existe.

O motor puro `margin-divisor-v1` foi entregue no Marco 1 em
`apps/api/src/pricing/calculator/`, com 77 testes próprios e 98 testes unitários
da API aprovados na validação desse marco. O motor não depende da persistência,
HTTP ou interface.

A direção arquitetural do Marco 2 está registrada na ADR-006. O commit `9427866`
versionou a fundação persistente e a migration
`20261003181002_add_pricing_persistence`. Em 04/10/2026, a migration foi aplicada
somente ao banco local de desenvolvimento; a validação local mostrou 16
migrations e banco atualizado. Não há confirmação sobre outros ambientes. O
schema, as relações e os guards SQL existem. Os Marcos 3B.1 e 3B.2 implementaram
o módulo HTTP, o contrato local de erros, a configuração organizacional e os
perfis de venda com deduções versionadas. Essas entregas usam revisão esperada,
locks, auditoria atômica, isolamento e strings decimais validadas.

O contrato e a segurança da API foram definidos documentalmente no Marco 3A
pela ADR-007. Composições, cálculos HTTP, snapshots runtime, versões, histórico
de cálculos, adoções, integração com produtos e interface web continuam sem
implementação.

## Processo de alteração

Toda mudança em fórmula ou significado financeiro deverá:

1. atualizar a especificação correspondente;
2. registrar uma decisão arquitetural quando alterar uma escolha estrutural;
3. incluir ou atualizar exemplos matemáticos;
4. incluir testes automatizados;
5. avaliar impactos sobre snapshots históricos;
6. atualizar a matriz de rastreabilidade do projeto.
