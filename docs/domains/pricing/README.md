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
- [ADR-008 — Arquitetura da interface web](../../architecture/decisions/ADR-008-pricing-web-architecture.md):
  direção aprovada de rotas, prévia decimal, estado, permissões, componentes e
  etapas do Marco 4.

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

O motor puro `margin-divisor-v1` foi entregue no Marco 1 e extraído no Marco
4B.1 para `packages/pricing-calculator/`. O pacote privado
`@meinager/pricing-calculator` é a fonte única da fórmula, possui `decimal.js`
como dependência direta e mantém a única suíte canônica completa com 77 testes,
incluindo EX-001 a EX-012. O motor não depende de persistência, HTTP, NestJS,
Prisma, React ou APIs exclusivas de Node. Os caminhos antigos em
`apps/api/src/pricing/calculator/` são reexports temporários com testes mínimos
de compatibilidade.

A direção arquitetural do Marco 2 está registrada na ADR-006. O commit `9427866`
versionou a fundação persistente e a migration
`20261003181002_add_pricing_persistence`. Em 04/10/2026, a migration foi aplicada
somente ao banco local de desenvolvimento; a validação local mostrou 16
migrations e banco atualizado. Não há confirmação sobre outros ambientes. O
schema, as relações e os guards SQL existem. Os Marcos 3B.1 e 3B.2 implementaram
o módulo HTTP, o contrato local de erros, a configuração organizacional e os
perfis de venda com deduções versionadas. O Marco 3C.1 acrescentou consulta e
substituição completa da composição de custos de cada produto, com componentes
manuais, copiados ou referenciados no catálogo. Essas entregas usam revisão
esperada, locks, auditoria atômica, isolamento e strings decimais validadas.
O Marco 3C.2 acrescentou a simulação autoritativa em
`POST /api/pricing/products/:productId/simulations`: a API resolve configuração,
perfil, composição ou rascunho e custos atuais do catálogo em uma única visão
`REPEATABLE READ`, executa o motor puro e devolve a memória completa sem
persistir versão ou alterar estado comercial.

O Marco 3C.3 implementou o contrato e o validador runtime do snapshot oficial
v1 e os endpoints de criação, listagem e detalhe das versões. Cada versão é
calculada novamente a partir da composição persistida, congela custos de
catálogo, configuração, perfil, proveniências e resultado integral, cria
projeções relacionais e passa de `BUILDING` para `FINALIZED` na mesma transação
da auditoria. Leituras históricas validam e devolvem o snapshot congelado, sem
recalcular dados atuais. O Marco 3D.1 acrescentou a adoção atômica de versões
finalizadas em `POST /api/pricing/products/:productId/adoptions`: o backend
valida e reproduz somente o snapshot congelado, bloqueia o produto e grava
preço, ponteiro, evento imutável e auditoria na mesma transação. A adoção abaixo
do mínimo exige papel, confirmação e justificativa, e repetições do estado atual
são idempotentes. O Marco 3D.2 concluiu a alteração manual pelo `PATCH` legado
de produto, o resumo comercial e a restrição de `directCost` para `VIEWER`.
Preço manual explícito é exclusivo de `OWNER`/`ADMIN`, limpa o vínculo com a
versão e gera auditoria atômica; a omissão preserva preço e origem. O resumo
expõe somente preço, origem manual ou versionada e existência de composição aos
cinco papéis autenticados. A interface de perfis de venda também consulta,
cria, edita e desativa perfis com deduções ordenadas. As interfaces de
composição, simulação, versões e adoção, além da integração da origem comercial
com orçamentos e pedidos, continuam pendentes.

O Marco 4A auditou a aplicação React, e a arquitetura da ADR-008 foi aprovada em
10/10/2026 sem implementar código. O Marco 4B.1 concluiu o pacote puro do motor,
sem adicionar dependência ou código à web. O Marco 4B.2 entregou a fundação web,
o resumo comercial no produto, a ação explícita de preço manual, contratos de
erro e consulta e a compatibilidade do catálogo quando `directCost` está ausente
para `VIEWER`. Edições comuns de produto não enviam mais `salePrice`. O Marco
4B.3 implementou a consulta, criação inicial e atualização parcial da
configuração organizacional na web, com percentuais em unidade humana,
proveniências, revisão esperada, conflitos explícitos e leitura por papel. O
Marco 4B.4 implementou lista, detalhe, criação, edição e desativação dos perfis,
com deduções e proveniências ordenadas, PATCH parcial, concorrência explícita e
proteção de rascunhos. A precificação continuará sendo integrada a Produtos nas
etapas 4C (composição/prévia), 4D (simulação/versões/adoção) e 4E (acabamento).
A futura prévia combinará o motor
puro compartilhado no navegador com a API como autoridade.

Também foi aprovado `isAdopted: boolean` somente na lista e no detalhe internos
de versões. O backend o calculará do ponteiro atual do produto, sem persistência
ou alteração do snapshot; `VIEWER` e o resumo comercial não receberão o campo.
A implementação e os testes próprios precederão a interface de histórico.

## Processo de alteração

Toda mudança em fórmula ou significado financeiro deverá:

1. atualizar a especificação correspondente;
2. registrar uma decisão arquitetural quando alterar uma escolha estrutural;
3. incluir ou atualizar exemplos matemáticos;
4. incluir testes automatizados;
5. avaliar impactos sobre snapshots históricos;
6. atualizar a matriz de rastreabilidade do projeto.
