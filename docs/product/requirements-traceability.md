# Matriz de rastreabilidade de requisitos

## 1. Finalidade

Este documento relaciona os requisitos do Meinager com a implementação
existente e com o trabalho ainda necessário.

Última revisão inicial: 02/10/2026.

Correções da auditoria técnica do Marco 0: 02/10/2026. Evidências detalhadas
em `docs/plans/pricing-engine.md`, seção `Descobertas`. Nenhum requisito novo
de precificação foi implementado nesta revisão.

Revisão do Marco 1: 03/10/2026. Motor puro concluído após correção dos
resultados documentais de EX-001/EX-002, autorizada por validação matemática
independente. Os 77 testes do motor e os 98 testes da API passaram. Os estados
abaixo distinguem a base matemática testada das integrações ainda ausentes.

Revisão da fundação de persistência: 05/10/2026. O commit `9427866` versionou os
modelos de precificação e a migration
`20261003181002_add_pricing_persistence`. Em 04/10/2026, a migration foi aplicada
somente ao banco local de desenvolvimento; a validação local mostrou 16
migrations e banco atualizado, sem comprovar outros ambientes. Essa evidência
estrutural não promove requisitos que ainda dependem de services, API, auditoria
da aplicação ou interface.

Revisão do Marco 3B.1: 05/10/2026. Os endpoints de configuração organizacional
possuem service versionado, autorização, isolamento, validação decimal,
auditoria atômica e testes de concorrência. A evidência é limitada à
configuração; perfis e os demais casos de uso da API permanecem pendentes.

Revisão do Marco 3B.2: 06/10/2026. Perfis e deduções possuem API versionada,
autorização, isolamento, auditoria, no-op e concorrência comprovados em banco
descartável. A integração desses perfis ao cálculo e ao snapshot permanece
pendente no Marco 3C.

Revisão do Marco 3C.1: 06/10/2026. Composições de produto possuem consulta e
substituição completa com revisão esperada, componentes ordenados, referências
de catálogo validadas, isolamento, auditoria e concorrência comprovados em banco
descartável. Simulação, snapshots, versões, histórico e adoção permanecem
pendentes nas próximas subetapas do Marco 3. A validação aprovou 10 testes
unitários direcionados, 40 E2E e 139 testes na suíte unitária completa da API.

Correção de serialização do Marco 3C.1: 07/10/2026. Um helper compartilhado
passou a serializar `Prisma.Decimal` com `toFixed()` sem precisão fixa em
configuração, perfis e composição. Testes unitários e E2E comprovam que
`0.00000001` persiste, retorna sem expoente e pode ser reenviado como no-op sem
nova revisão ou auditoria. A validação atual aprovou 36 testes unitários
direcionados, 43 E2E e 140 testes em 13 arquivos na suíte unitária completa da
API.

Revisão do Marco 3C.2: 07/10/2026. A simulação autoritativa passou a resolver
configuração, perfil, composição ou rascunho e catálogo em `REPEATABLE READ`,
sem persistir versão ou alterar estado comercial. A validação aprovou 24 testes
unitários direcionados, 54 E2E e 160 testes em 15 arquivos na suíte unitária
completa da API.

Revisão do Marco 3C.3: 08/10/2026. O snapshot v1 possui validação runtime e
replay canônico; criação, lista e detalhe de versões possuem autorização,
isolamento, imutabilidade, congelamento histórico, auditoria, rollback e
concorrência cobertos. A validação aprovou 29 testes unitários direcionados, 57
E2E em banco descartável e 189 testes em 18 arquivos na suíte unitária completa
da API. Adoção, integração comercial e interface permanecem pendentes.

Revisão do Marco 3D.1: 09/10/2026. A API adota versões finalizadas de forma
atômica, valida exclusivamente o histórico congelado, aplica a matriz de papéis,
registra evento e auditoria e garante idempotência sob lock do produto. A
validação aprovou 40 testes unitários direcionados, 61 E2E em PostgreSQL
descartável e 218 testes em 20 arquivos na suíte unitária completa da API.
Alteração manual do preço, resumo comercial, compatibilidade de `directCost` e
interface permanecem pendentes.

Revisão do Marco 3D.2: 09/10/2026. O preço manual explícito agora limpa a
versão adotada e audita a decisão atomicamente; omissão preserva preço e origem.
O resumo comercial expõe somente cinco campos, e os endpoints legados de
produto não consultam nem retornam `directCost` para `VIEWER`. A validação
aprovou 29 testes unitários direcionados, 79 E2E em PostgreSQL descartável e
241 testes em 21 arquivos na suíte unitária completa da API. Interface web e
integração da origem comercial com orçamentos e pedidos permanecem pendentes.

Revisão documental do Marco 4A: 10/10/2026. A ADR-008 foi aprovada com a
arquitetura da interface, a divisão 4B.1–4E e a prévia híbrida com motor
compartilhado e API autoritativa. A extensão `isAdopted: boolean` também foi
aprovada somente para lista e detalhe internos de versões; sua implementação e
testes permanecem pendentes antes do histórico web. Nenhum estado de requisito
de interface foi promovido.

Revisão do Marco 4B.1: 10/10/2026. O motor `margin-divisor-v1` e sua única
suíte canônica completa de 77 testes foram extraídos para o pacote privado ESM
`@meinager/pricing-calculator`. A API preserva reexports temporários e três
testes mínimos de compatibilidade; `decimal.js` pertence ao pacote. Essa entrega
comprova somente a fundação compartilhada: a web ainda não depende do pacote,
e recálculo local, prévia e demais requisitos de interface continuam pendentes.
A validação aprovou 77 testes no pacote, 167 em 21 arquivos da API, 79 E2E em
sete arquivos no PostgreSQL descartável e 68 testes em 22 arquivos da web; os
pipelines raiz de typecheck, lint, teste e build passaram.

Revisão do Marco 4B.2: 13/10/2026. A web passou a validar o resumo comercial e
erros estruturados, omitir `salePrice` da edição comum, aceitar Produtos sem
`directCost`, ocultar custo de `VIEWER` e oferecer preço manual explícito somente
a `OWNER`/`ADMIN`. A validação aprovou 62 testes direcionados, 124 testes em 31
arquivos da web e 368 testes nos três packages. Configuração, perfis, composição,
prévia local, histórico e adoção web permanecem pendentes; `isAdopted` continua
sem contrato ou implementação na web.

Marco 4B.3 implementado em 13/10/2026 e revisado em 14/10/2026. A rota de
configuração organizacional passou a consultar, criar e atualizar o contrato
real da API. A web converte
percentuais por texto, envia PATCH parcial com revisão e proveniências, preserva
rascunho em conflitos e aplica leitura/escrita aos quatro papéis internos sem
query para `VIEWER`. A revisão final comprovou alterações exclusivas de
proveniência, recarga de conflito sem aceitar cache antigo e proteção de
rascunho por React Router e `beforeunload`. A validação aprovou 94 testes
direcionados, 178 testes em 35 arquivos da web e 422 testes nos três packages.
Perfis e os marcos seguintes permanecem pendentes.

Marco 4B.4 implementado em 18/10/2026. As rotas de perfis passaram a listar,
paginar, filtrar, detalhar, criar, editar e desativar pelos contratos reais da
API. Deduções ordenadas e proveniências usam strings decimais canônicas, PATCH
parcial, revisão esperada, no-op e resolução explícita de conflitos. A matriz de
papéis foi comprovada sem query interna para `VIEWER`; rascunhos de criação e
edição possuem proteção de navegação. A validação aprovou 31 testes direcionados,
207 testes em 40 arquivos da web e 451 testes nos três packages. Composição,
prévia, simulação, versões e adoção na web permanecem pendentes.

Marco 4C.1 implementado em 19/10/2026 e revisado em 20/10/2026. A página do
produto passou a consultar, criar e substituir a composição persistida completa
com strings decimais, componentes ordenados, catálogo, mão de obra, frete,
proveniências e revisão esperada. Conflitos, no-op, recarga segura, proteção
contra refetch automático e proteção de rascunho possuem testes; `VIEWER` não
inicia consultas internas. Perfis e catálogo percorrem todas as páginas ativas,
e referências históricas inativas são identificadas sem voltar a ser elegíveis.
Foram aprovados 42 testes direcionados e 247 testes da web em 42 arquivos com
concorrência central limitada a quatro workers. Prévia local, simulação, versões
e adoção na web continuam pendentes.

Marco 4C.2 implementado em 20/10/2026. A web passou a consumir diretamente o
pacote compartilhado por um adaptador puro equivalente à resolução da API e
apresenta a prévia local sem escrita ou chamada a `/simulations`. EX-001 e
EX-002, origem e precedência da margem efetiva, estados de dependência, papéis,
decomposição e uma execução síncrona inferior a 100 ms possuem testes de
integração. A suíte web aprovou 280 testes em 43 arquivos. Simulação autoritativa
na interface, versões, histórico, `isAdopted` e adoção ainda permaneciam
pendentes nessa etapa.

Marco 4D.1 implementado em 22/10/2026. Lista e detalhe internos de versões
agora projetam `isAdopted` dinamicamente a partir do ponteiro atual do produto,
sem persistência, N+1, escrita ou auditoria. Testes unitários e E2E comprovam
ponteiro nulo, adoções sucessivas, preço manual, papéis, isolamento e histórico
imutável. A interface de simulação, histórico e adoção permanece pendente nos
Marcos 4D.2–4D.4.

Revisão crítica em 24/10/2026 confirmou também a rejeição de `isAdopted` como
entrada do POST, a resposta `false` quando a versão adotada está fora da página
e a preservação integral de snapshot, componentes e deduções. `PREC-CA-038`
permanece `PARTIAL` porque lista e detalhe ainda não existem na interface.

Marco 4D.2 implementado em 25/10/2026. A web confirma a prévia por simulação
autoritativa explícita, seleciona `PERSISTED` ou `DRAFT` pelo estado semântico do
formulário e valida a resposta integral por contratos runtime estritos. O
resultado remoto é transitório, não invalida cache, não altera o rascunho e é
descartado ou marcado como desatualizado após mudanças. A suíte web aprovou 314
testes em 47 arquivos. Requisitos de criação de versão, histórico visual,
`isAdopted` na interface e adoção não foram promovidos.

Marco 4D.3 implementado em 26/10/2026. A página do produto cria uma versão
finalizada somente após confirmação `PERSISTED` vigente e em paridade, lista
versões paginadas e abre snapshot histórico validado em detalhe somente
leitura. `isAdopted` é exibido textualmente conforme os GETs, inclusive quando
todas as versões da página retornam `false`; o POST permanece sem esse campo.
Testes web cobrem permissões, cache, pré-condições, conflitos, paginação,
detalhe e ausência de adoção. A suíte web aprovou 338 testes em 50 arquivos;
os pipelines raiz aprovaram 586 testes. Adoção pela web e integração com
orçamentos e pedidos permanecem pendentes.

Revisão crítica em 27/10/2026 corrigiu o contrato web dos preços comerciais de
versão: as colunas `Text` preservam duas casas, inclusive zero final. Testes
comprovam também a correspondência das entradas resolvidas, da origem da margem
e das projeções ao snapshot, além do vínculo das respostas ao produto, à revisão
e à versão solicitados. A suíte web oficial
aprovou 338 testes em 50 arquivos, e a raiz aprovou 586 testes. O estado de
`PREC-CA-038` permanece `IMPLEMENTED`; adoção web, orçamentos e pedidos não foram
promovidos.

Marco 4D.4 implementado em 27/10/2026. A web permite adoção explícita de versão
finalizada pelo histórico, com confirmação e justificativa abaixo do mínimo
restritas a OWNER/ADMIN. OPERATIONS pode adotar versões normais; FINANCE mantém
somente leitura e VIEWER não consulta dados internos. Contratos runtime validam
entrada, resposta e identificadores; a mutation invalida resumo, produtos e
projeção dinâmica de versões sem alterar cache histórico ou rascunho. A suíte
web aprovou 356 testes em 52 arquivos e os pipelines raiz aprovaram 604 testes.
Integrações comerciais e Marco 4E permanecem pendentes; seus estados não foram
promovidos.

Revisão crítica do Marco 4D.4 em 28/10/2026: a justificativa não fica mais em
`mutation.variables`; a adoção não cria entrada no `MutationCache`. Resultado
desconhecido por falha de rede, resposta 2xx inválida ou erro 5xx força
releitura do estado comercial sem afirmar rollback, inclusive após desmontagem.
Uma simulação anterior não volta a autorizar criação de versão após adoção.
Retry idempotente da versão abaixo do mínimo já adotada preserva a semântica
do backend. A suíte web aprovou 361 testes em 52 arquivos e a raiz aprovou 609
testes. Estados dos requisitos de integração comercial e Marco 4E não foram
promovidos.

Revisão 4E.1 em 31/10/2026: quatro regressões cobrem mensagens seguras para
respostas 2xx incompatíveis de resumo, configuração, composição e perfis.
Diálogos extensos receberam rolagem limitada à viewport. Os testes direcionados
aprovaram 97 casos em quatro arquivos; a suíte web aprovou 365 testes em 53
arquivos e a raiz aprovou 613 (77 motor, 171 API e 365 web). Esta evidência usa
componentes com mocks e inspeção de código; não comprova visual em navegador
nem fluxo real web → API → PostgreSQL. `PREC-CA-054` a `PREC-CA-057` continuam
`PARTIAL`, e a integração comercial continua pendente.

Preparação do piloto em 31/10/2026: um teste Playwright em navegador real,
sem mocks HTTP, percorreu cadastro fictício, precificação, versão, adoção e
preço manual em PostgreSQL descartável. FINANCE, VIEWER e isolamento entre
organizações tiveram verificações representativas; 360/768/1280 px e foco do
detalhe foram exercitados. A evidência está em
`docs/pilot/casa-nacoli-preparation.md` e não promove o Marco 4E ou requisitos
de orçamento, pedido, zoom real, fluxo de membros e operação em homologação.
Esta frase registra o estado da primeira entrega do piloto. A entrega posterior
de membros acrescentou convite, aceite e troca explícita de organização; o
runner Playwright aprovou três testes com API e PostgreSQL descartável, incluindo
sessão legada revogada pela nova migration, isolamento entre sessões, alteração
de papel, desativação de vínculo e rollback da auditoria. A migration de convites
foi aplicada somente nas bases descartáveis; a aplicação ao banco normal e a
operação com Nicolas e Carol reais continuam pendentes. O mecanismo de convite
local não verifica a posse da caixa de e-mail. Na rodada, typecheck, lint,
test e build da raiz passaram com 184 testes API, 366 web e 77 do motor,
totalizando 627.
Revisão de segurança posterior: a geração do contexto passou a distinguir
também A → B → A. O E2E descartável comprovou isolamento em `clients`,
resposta de leitura atrasada, mutação iniciada antes da troca, rascunho
protegido, corrida entre aceite e revogação, sessão expirada e logout.
A migration foi repetida sobre baseline populado com preservação dos registros
e revogação somente da sessão legada ativa. Os pipelines raiz passaram com
184 testes API, 368 web e 77 do motor, total de 629. O estado dos convites
permanece `PARTIAL` até aplicação autorizada da migration no ambiente do
piloto; a verificação de e-mail segue necessária antes de abertura pública.
O teste integrado passou uma vez na execução final; as bases descartáveis da
execução e da prova de falha foram removidas. As suítes oficiais passaram com
365 testes web, 171 API e 77 do motor, total de 613. Os estados da matriz não
foram promovidos por essa amostra.

A matriz deve ser atualizada durante a implementação. Um requisito somente pode
ser marcado como implementado quando possuir evidência de código e validação
automatizada aplicável.

## 2. Estados

| Estado        | Significado                                                          |
| ------------- | -------------------------------------------------------------------- |
| `IMPLEMENTED` | Comportamento disponível e coberto pela implementação atual          |
| `PARTIAL`     | Existe uma base reutilizável, mas o requisito ainda exige alterações |
| `PENDING`     | Funcionalidade ainda não implementada                                |
| `VERIFY`      | Há indícios de implementação, mas é necessária inspeção detalhada    |
| `FUTURE`      | Evolução prevista fora da primeira entrega da precificação           |

## 3. Evidências gerais do repositório

### Backend

A API possui módulos para:

- autenticação e sessão;
- autorização por papel;
- clientes;
- produtos;
- estoque;
- categorias financeiras;
- contas financeiras;
- lançamentos;
- baixas;
- períodos;
- resumo financeiro;
- orçamentos;
- pedidos;
- fluxos configuráveis de pedidos;
- saúde da aplicação;
- configuração organizacional de precificação.
- perfis de venda e deduções de precificação;
- composições de custos de produtos.
- simulações autoritativas de precificação;
- snapshots e versões históricas de cálculo.
- adoção atômica de versões de precificação.
- alteração manual auditada e resumo comercial de precificação.

A auditoria utiliza o modelo `AuditLog` e gravações nos services dos módulos;
não existe módulo Nest específico de auditoria. `PricingConfigurationService`
também grava seu evento na transação da mutação.

### Frontend

A aplicação web possui funcionalidades e páginas para:

- autenticação;
- clientes;
- produtos;
- estoque;
- financeiro;
- orçamentos;
- pedidos;
- configuração de fluxos de pedidos.

### Persistência

O schema Prisma possui modelos para:

- usuários e organizações;
- membros e sessões;
- convites para membros e organização ativa por sessão, ainda não migrados no banco normal;
- auditoria;
- clientes;
- produtos;
- movimentações de estoque;
- orçamentos e itens;
- pedidos e itens;
- fluxos, etapas e transições;
- períodos financeiros;
- categorias;
- contas;
- lançamentos;
- baixas;
- configuração e revisões de precificação;
- perfis, revisões e deduções;
- composições e componentes;
- versões, projeções e adoções de preço.

A fundação persistente de precificação está versionada no commit `9427866`, em
`apps/api/prisma/schema.prisma` e na migration
`20261003181002_add_pricing_persistence`. A aplicação da migration comprovada em
04/10/2026 limita-se ao banco local de desenvolvimento. Os casos de uso ainda
pendentes não são promovidos pelas APIs já entregues de configuração, perfis e
composição.

## 4. Situação dos módulos gerais

| Área                              | Estado        | Evidência atual                                                                                                                    | Trabalho necessário                                                                  |
| --------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Autenticação                      | `IMPLEMENTED` | `apps/api/src/auth` e `apps/web/src/features/auth`                                                                                 | Preservar                                                                            |
| Sessões                           | `IMPLEMENTED` | `apps/api/src/auth/session`                                                                                                        | Preservar                                                                            |
| Convites e seleção de organização | `PARTIAL`     | API, web e três testes Playwright com banco descartável; migration de convites e revogação de sessões legadas testadas somente ali | Aplicar migration em ambiente autorizado; verificar e-mail antes de abertura pública |
| Autorização por papel             | `IMPLEMENTED` | `apps/api/src/auth/authorization`                                                                                                  | Reutilizar na precificação                                                           |
| Isolamento por organização        | `IMPLEMENTED` | Serviços existentes e modelos organizacionais                                                                                      | Cobrir novos recursos                                                                |
| Auditoria                         | `PARTIAL`     | Modelo `AuditLog` e usos existentes                                                                                                | Adicionar ações de precificação                                                      |
| Clientes                          | `IMPLEMENTED` | `apps/api/src/clients` e páginas de clientes                                                                                       | Preservar                                                                            |
| LTV de clientes                   | `PENDING`     | Sem evidência específica                                                                                                           | Implementar em evolução posterior                                                    |
| Produtos e serviços               | `IMPLEMENTED` | `apps/api/src/products` e páginas de produtos                                                                                      | Estender sem quebrar preços atuais                                                   |
| Estoque                           | `IMPLEMENTED` | `apps/api/src/inventory`                                                                                                           | Permitir referência a insumos                                                        |
| Categorias financeiras            | `IMPLEMENTED` | `FinancialCategory.type` (`FIXED_EXPENSE`) no schema e `apps/api/src/finance/categories/categories.service.ts`                     | Reutilizar classificação explícita já existente                                      |
| Contas financeiras                | `IMPLEMENTED` | `apps/api/src/finance/accounts`                                                                                                    | Preservar                                                                            |
| Lançamentos                       | `IMPLEMENTED` | `apps/api/src/finance/entries`                                                                                                     | Reutilizar futuramente nos agregados                                                 |
| Baixas financeiras                | `IMPLEMENTED` | `apps/api/src/finance/settlements`                                                                                                 | Reutilizar para receita realizada                                                    |
| Períodos financeiros              | `IMPLEMENTED` | `apps/api/src/finance/periods`                                                                                                     | Reutilizar na janela de faturamento                                                  |
| Resumo financeiro                 | `IMPLEMENTED` | `apps/api/src/finance/summary`                                                                                                     | Estender futuramente                                                                 |
| Recorrência financeira            | `VERIFY`      | Nenhum módulo específico identificado                                                                                              | Inspecionar antes de planejar                                                        |
| Orçamentos                        | `IMPLEMENTED` | `apps/api/src/quotes` e páginas de orçamentos                                                                                      | Acrescentar referência opcional de precificação                                      |
| Pedidos                           | `IMPLEMENTED` | `apps/api/src/orders` e páginas de pedidos                                                                                         | Preservar snapshots                                                                  |
| Fluxos de pedidos                 | `IMPLEMENTED` | `apps/api/src/order-workflows`                                                                                                     | Não alterar pela precificação                                                        |
| Calendário                        | `PENDING`     | Nenhum módulo identificado                                                                                                         | Evolução posterior                                                                   |
| Notificações                      | `PENDING`     | Nenhum módulo identificado                                                                                                         | Evolução posterior                                                                   |
| Metas                             | `PENDING`     | Nenhum módulo identificado                                                                                                         | Evolução posterior                                                                   |
| Ponto de equilíbrio               | `PENDING`     | Nenhum módulo identificado                                                                                                         | Evolução posterior                                                                   |
| Backup e criptografia em repouso  | `VERIFY`      | Responsabilidade de infraestrutura                                                                                                 | Documentar no plano de implantação                                                   |

## 5. Rastreabilidade da precificação

### Evidências do motor puro — Marcos 1 e 4B.1

Os caminhos abaixo são relativos a `packages/pricing-calculator/src/`, fonte
única da implementação desde o Marco 4B.1. A especificação de tipos está em
`pricing-calculator.types.ts`; validação/representação decimal em
`pricing-decimal.ts`; erros em `pricing-calculator.errors.ts`; e a suíte
canônica completa em `pricing-calculator.spec.ts`. ADR-005 registra precisão e
limites técnicos. Os arquivos correspondentes em
`apps/api/src/pricing/calculator/` são somente reexports temporários.

| Requisito                 | Estado        | Evidência de código e teste                                                                                                                                           | Limite da entrega                                                       |
| ------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| EX-001                    | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, teste `EX-001 — precificação simples`: lucro exato `22.728`, exibido `22.73` e margem percentual `25.0005` com ROUND_HALF_UP | Expectativas corrigidas após validação independente; somente motor puro |
| EX-002                    | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, teste `EX-002 — precificação completa`: lucro exato `35.3453` e margem percentual `25.0002` com ROUND_HALF_UP                | Expectativas corrigidas após validação independente; somente motor puro |
| EX-003 a EX-012           | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, dez testes com os respectivos IDs no nome                                                                                    | Cenários matemáticos aprovados; sem integração de domínio               |
| PREC-CA-013 e PREC-CA-016 | `IMPLEMENTED` | `calculator/pricing-calculator.ts`; testes de componentes fracionários e negativos por campo                                                                          | Multiplicação e rejeição tipada no motor                                |
| PREC-CA-019 e PREC-CA-021 | `IMPLEMENTED` | Testes EX-009/EX-010 e denominadores ativos com numerador zero                                                                                                        | Validação condicional dos modos utilizados                              |
| PREC-CA-023 e PREC-CA-024 | `IMPLEMENTED` | `calculator/pricing-calculator.spec.ts`, testes EX-001 e EX-002 aprovados contra os resultados oficiais corrigidos                                                    | Cálculo simples e completo no motor puro                                |
| PREC-CA-025               | `IMPLEMENTED` | EX-006/EX-007 e divisor mínimo inválido com custo zero                                                                                                                | Erro tipado com mensagem, nenhum preço retornado                        |
| PREC-CA-030 e PREC-CA-032 | `PARTIAL`     | Simulação, versão e adoção preservam lucro, margem, classificação e avisos calculados pelo backend                                                                    | Exposição e adoção pela interface pendentes                             |
| PREC-CA-051 e PREC-CA-053 | `IMPLEMENTED` | EX-011, mínimo para cima, fronteiras de centavo e lucro residual                                                                                                      | Arredondamento e recálculo decimal no motor                             |
| PREC-CA-050               | `IMPLEMENTED` | EX-001 a EX-012 aprovados em `calculator/pricing-calculator.spec.ts`; precisão, grandes quantidades e divisores próximos de zero testados                             | Reprodução decimal dos exemplos no motor puro                           |
| PREC-CA-052               | `PARTIAL`     | `PricingMoney.display`, teste de half-up sem realimentar cálculo                                                                                                      | Formatação retornada pelo motor; exibição web pendente                  |

Evidência de execução em 03/10/2026: 77 de 77 testes do motor aprovados;
suíte completa da API com 98 testes aprovados em 7 arquivos. O bloqueio foi
removido após essas validações e a correção documental autorizada, sem alterar
fórmulas ou arredondar valores intermediários. Naquela validação, persistência,
endpoints, services e interface ainda estavam ausentes.

Evidência de execução do Marco 4B.1 em 10/10/2026: os 77 testes passaram no
pacote, com EX-001 a EX-012 preservados; a API aprovou 167 testes em 21 arquivos
com os reexports temporários. O pacote gerou JavaScript ESM e declarações de
tipo importáveis sem artefato versionado. A web não foi alterada.

### Configuração da organização

| Critérios                     | Estado        | Base reutilizável                                                                                                                    | Implementação esperada                                              |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `PREC-CA-001` a `PREC-CA-004` | `IMPLEMENTED` | API e web cobrem ausência, criação, atualização parcial, revisão, papéis, origens e valores mensais                                  | Cálculo derivado pertence à etapa posterior                         |
| `PREC-CA-005`                 | `PARTIAL`     | Valores mensais são persistidos e o motor sabe derivar a taxa                                                                        | Exposição do percentual derivado pela API e interface pendente      |
| `PREC-RN-001`                 | `PARTIAL`     | Filtro pela organização da sessão, relações compostas e E2E da configuração com duas organizações                                    | Comprovar isolamento nos demais recursos da API                     |
| `PREC-RN-002` e `PREC-RN-003` | `PARTIAL`     | API e web preservam origens não alteradas, aceitam mudança exclusiva de proveniência e nunca enviam o confirmador derivado da sessão | Integração automática com agregados financeiros permanece pendente  |
| `PREC-RN-004`                 | `IMPLEMENTED` | Vigência definida pelo backend; a versão referencia e congela a revisão vigente, preservada por guards SQL                           | Comprovado na criação e leitura histórica do Marco 3C.3             |
| `PREC-RN-005`                 | `PARTIAL`     | Faturamento zero é rejeitado e a proveniência aceita período e origem                                                                | Garantir janela e origem do faturamento na configuração ou snapshot |

### Perfis de deduções

| Critérios                     | Estado        | Base reutilizável                                                                                        | Implementação esperada                           |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `PREC-CA-006` a `PREC-CA-008` | `IMPLEMENTED` | API e web cobrem criação, nomes não vazios, deduções extensíveis e ordenadas, revisão e desativação      | Comprovado por unitários, E2E e testes web       |
| `PREC-CA-009`                 | `IMPLEMENTED` | Perfis externos são ocultados; composição, simulação e criação de versão validam o perfil da organização | Regra comprovada também no fluxo persistente     |
| `PREC-RN-021`                 | `IMPLEMENTED` | Versões congelam deduções ordenadas; a web preserva a ordem visual e substitui a coleção explicitamente  | Histórico de versões permanece no Marco 4D       |
| `PREC-RN-022`                 | `IMPLEMENTED` | API e web oferecem perfis organizacionais versionados, com nomes e percentuais configuráveis             | Comprovado por contratos e testes de papéis      |
| `PREC-RN-023`                 | `IMPLEMENTED` | Snapshot e projeções preservam cada dedução, taxa, origem, valor calculado e ordem                       | Comprovado por validação runtime e E2E histórico |

### Composição de custos

| Critérios                     | Estado        | Base reutilizável                                                                                                                            | Implementação esperada                        |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `PREC-CA-010` e `PREC-CA-011` | `IMPLEMENTED` | API e editor web criam e substituem composição completa; testes cobrem categorias, ordem visual e componentes `MANUAL`, `COPIED` e `CATALOG` | Prévia local permanece no Marco 4C.2          |
| `PREC-CA-012` a `PREC-CA-016` | `IMPLEMENTED` | Editor percorre o catálogo ativo, exige custo string, omite custo de `CATALOG`, impede autorreferência e preserva referências históricas     | Exposição histórica permanece no Marco 4D     |
| `PREC-RN-006` a `PREC-RN-011` | `IMPLEMENTED` | Web preserva decimais textuais e condições por origem; backend autoritativo valida custos e catálogo, e snapshot preserva a execução         | Prévia dos resultados permanece no Marco 4C.2 |

### Mão de obra

| Critérios                     | Estado        | Base reutilizável                                                                                                             | Implementação esperada                                        |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `PREC-CA-017` a `PREC-CA-019` | `PARTIAL`     | Editor e prévia calculam e exibem custo por hora, minuto e total; parâmetros ausentes ou inválidos bloqueiam o resultado      | Conversão opcional de horas na interface não foi implementada |
| `PREC-RN-012` a `PREC-RN-015` | `IMPLEMENTED` | Configuração, composição, motor, snapshot e prévia preservam custo mensal, horas produtivas, minutos e memória de mão de obra | Comprovado pelo adaptador e painel web                        |

### Frete

| Critérios                     | Estado        | Base reutilizável                                                                                         | Implementação esperada                         |
| ----------------------------- | ------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `PREC-CA-020` a `PREC-CA-022` | `IMPLEMENTED` | Editor e prévia cobrem frete ausente, manual e rateado, consumo padrão e erro tipado para quantidade zero | Comprovado por testes do adaptador e interface |
| `PREC-RN-016` e `PREC-RN-017` | `IMPLEMENTED` | Web, service, motor e snapshot preservam os dois modos e exibem custo por unidade e total                 | Comprovado por integração local e backend      |

### Motor de cálculo

| Critérios                                                    | Estado        | Base reutilizável                                                                                                                                                                            | Implementação esperada                                    |
| ------------------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `PREC-CA-023` a `PREC-CA-028`                                | `IMPLEMENTED` | EX-001/EX-002 passam pelo adaptador; painel mostra decomposição; a web compara o resultado integral com a simulação autoritativa; divisor inválido e recálculo abaixo de 100 ms são testados | Simulação transitória não cria versão                     |
| `PREC-RN-018`, `PREC-RN-019` e `PREC-RN-021` a `PREC-RN-027` | `IMPLEMENTED` | Pacote, API, snapshot e prévia preservam taxa fixa, deduções, margem, preços e limites do `margin-divisor-v1`                                                                                | Comprovado nas fronteiras entregues                       |
| `PREC-RN-020`                                                | `FUTURE`      | A primeira estratégia permanece percentual conforme ADR-001                                                                                                                                  | Custo fixo unitário é evolução futura                     |
| `EX-001` a `EX-012`                                          | `IMPLEMENTED` | 12 testes aprovados, nomeados por exemplo em `packages/pricing-calculator/src/pricing-calculator.spec.ts`                                                                                    | Cenários matemáticos aprovados; sem integração de domínio |

### Preço adotado

| Critérios                     | Estado        | Base reutilizável                                                                                                                            | Implementação esperada                                          |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `PREC-CA-029` e `PREC-CA-031` | `IMPLEMENTED` | A versão sugerida ou personalizada é validada e adotada atomicamente; o produto recebe preço e ponteiro com auditoria                        | Comprovado por unitários e E2E do Marco 3D.1                    |
| `PREC-CA-030` e `PREC-CA-032` | `PARTIAL`     | Criação de versão recalcula preços personalizados; adoção web usa sua análise e classificação congeladas                                     | Validação integral do fluxo no Marco 4E pendente                |
| `PREC-CA-033`                 | `IMPLEMENTED` | Somente OWNER/ADMIN confirmam preço abaixo do mínimo, com confirmação e justificativa; OPERATIONS recebe 403                                 | Comprovado por unitários e E2E                                  |
| `PREC-CA-034`                 | `PARTIAL`     | Simulação e versão não alteram preço; edição comum omite `salePrice`; adoção e preço manual são ações explícitas na web                      | Validação integral do fluxo no Marco 4E pendente                |
| `PREC-RN-028` a `PREC-RN-031` | `PARTIAL`     | Backend analisa preço personalizado e adota `analyzedPrice`; a web confirma adoção, exige justificativa abaixo do mínimo e preserva rascunho | Integração comercial e validação integral do Marco 4E pendentes |

### Decomposição e explicação

| Critérios                     | Estado        | Base reutilizável                                                                                            | Implementação esperada                                |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `PREC-CA-026`                 | `IMPLEMENTED` | Prévia apresenta custo-base, componentes, custos fixos, deduções, preços, lucro, margens, desconto e fórmula | Comprovado pelo painel e testes web                   |
| `PREC-RN-032` e `PREC-RN-033` | `IMPLEMENTED` | Snapshot v1 validado preserva entradas, resultado integral, configuração, fórmula, autoria e data            | Interface web pendente                                |
| `PREC-RN-034`                 | `IMPLEMENTED` | Rascunho recalcula localmente sem salvar; resultado transitório permanece separado do cache e da composição  | Comprovado por edição imediata e ausência de PUT/POST |

### Histórico e snapshots

| Critérios                     | Estado        | Base reutilizável                                                                                                                                                                     | Implementação esperada                            |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `PREC-CA-035` a `PREC-CA-037` | `IMPLEMENTED` | POST cria versão finalizada imutável com snapshot v1, projeções, autoria, fórmula e auditoria; E2E prova preservação após mudanças                                                    | Adoção não faz parte destes critérios             |
| `PREC-CA-038`                 | `IMPLEMENTED` | GET paginado e detalhe validado exibem versões finalizadas com `isAdopted` dinâmico; a web pagina, abre detalhe e identifica textualmente a versão adotada                            | Preservar a leitura histórica nos próximos fluxos |
| `PREC-RN-035`                 | `IMPLEMENTED` | Cada cálculo salvo recebe número sequencial e snapshot imutável; concorrência real cria números únicos                                                                                | Comprovado no Marco 3C.3                          |
| `PREC-RN-036` a `PREC-RN-038` | `IMPLEMENTED` | Versões e auditoria permanecem imutáveis; itens comerciais guardam preço, origem e versão opcional. Replay populado e percurso real preservam os documentos após alteração do produto | Provas em PostgreSQL descartável e Playwright     |

### Integração com produtos

| Critérios     | Estado        | Base reutilizável                                                                                                                  | Implementação esperada                     |
| ------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `PREC-CA-039` | `IMPLEMENTED` | Produtos sem composição preservam o preço legado; resumo e preço manual funcionam na API e na interface sem versão de precificação | Comprovado por testes web e E2E            |
| `PREC-RN-042` | `IMPLEMENTED` | Adoção vincula preço e versão; alteração manual limpa o ponteiro; ambas são atômicas e preservam o preço do catálogo               | Integração com orçamentos/pedidos pendente |

### Integração com orçamentos

| Critérios     | Estado        | Base reutilizável                                                                                                                                                                | Implementação esperada                          |
| ------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `PREC-CA-040` | `IMPLEMENTED` | `FinancialQuoteItem` guarda preço, origem e versão opcional capturados na transação; 59 E2E e Playwright real cobrem conflito de preço/origem, reordenação e histórico congelado | Sem inferência retroativa para legado           |
| `PREC-RN-036` | `IMPLEMENTED` | Seleção explícita de catálogo/manual/histórico; replay populado e edição por quantidade/desconto preservam preço e referência                                                    | Dados internos não entram no contrato comercial |

### Integração com pedidos

| Critérios     | Estado        | Base reutilizável                                                                                                         | Implementação esperada                   |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `PREC-CA-041` | `IMPLEMENTED` | `SalesOrderItem` copia preço, origem e versão do orçamento aprovado; Playwright verifica o pedido após mudança do produto | Sem recálculo ou consulta à adoção atual |
| `PREC-RN-037` | `IMPLEMENTED` | `OrdersService` copia o snapshot comercial; replay populado preserva pedidos antigos com origem nula                      | Referência histórica permanece válida    |

### Integração com estoque e financeiro

| Critérios                     | Estado        | Base reutilizável                                                                                     | Implementação esperada            |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------- |
| `PREC-CA-042`                 | `IMPLEMENTED` | E2E compara movimentações antes/depois da criação e adoção de versão e não encontra efeitos           | Preservar nas etapas posteriores  |
| `PREC-CA-043`                 | `IMPLEMENTED` | E2E compara lançamentos antes/depois da criação e adoção de versão e não encontra efeitos             | Preservar nas etapas posteriores  |
| `PREC-RN-039` a `PREC-RN-041` | `FUTURE`      | Módulos financeiros existentes                                                                        | Agregados financeiros posteriores |
| `PREC-RN-043` e `PREC-RN-044` | `IMPLEMENTED` | E2E comprova ausência de efeitos de composição, simulação, versão e adoção sobre estoque e financeiro | Preservar na interface            |

### Fluxos de pedidos

| Critérios     | Estado    | Base reutilizável                                                                              | Implementação esperada                                       |
| ------------- | --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `PREC-CA-044` | `PARTIAL` | `apps/api/src/order-workflows/order-workflows.service.ts` e `apps/api/test/orders.e2e-spec.ts` | Validar preservação dos fluxos após implementar precificação |
| `PREC-RN-045` | `PARTIAL` | `order-workflows`; `OrdersService.createFromQuote` copia snapshots sem motor                   | Preservar a separação ao integrar precificação               |

A existência de fluxos fornece uma base parcial. Composição, simulação e criação
de versão possuem testes próprios de ausência de efeitos. Os testes existentes
de pedidos comprovam o comportamento atual, mas não a integração futura.

### Permissões

| Critérios                     | Estado        | Base reutilizável                                                                                                                  | Implementação esperada            |
| ----------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `PREC-CA-045` a `PREC-CA-049` | `IMPLEMENTED` | E2E cobre a API; configuração, perfis e composição web comprovam a matriz de escrita/leitura e nenhuma query interna para `VIEWER` | Preservar nos próximos fluxos web |
| Acesso não autenticado        | `IMPLEMENTED` | Endpoints de precificação, inclusive adoção e resumo comercial, rejeitam ausência de sessão com `401`                              | Preservar nos endpoints futuros   |
| Isolamento organizacional     | `IMPLEMENTED` | Services filtram pela organização da sessão; E2E oculta recursos externos também no preço manual e no resumo                       | Preservar nas integrações futuras |

O contrato legado de produtos possui E2E específico de não vazamento:
`OWNER`, `ADMIN`, `OPERATIONS` e `FINANCE` continuam recebendo `directCost` em
lista e detalhe, enquanto a projeção Prisma usada para `VIEWER` não seleciona
nem retorna a propriedade. O schema web preserva essa ausência, e a listagem não
renderiza coluna, valor, placeholder ou indicação de custo para `VIEWER`.

### Precisão e arredondamento

| Critérios                     | Estado        | Base reutilizável                                                                                                         | Implementação esperada                                  |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `PREC-CA-050` a `PREC-CA-053` | `IMPLEMENTED` | Pacote e API preservam precisão; o painel usa `display`/`commercial`, percentuais textuais e análise após preço comercial | EX-001/EX-002 e `0.00000001` cobertos na integração web |
| `ADR-002`                     | `IMPLEMENTED` | Motor, persistência, snapshot e adaptador web usam strings canônicas; a projeção visual não realimenta o cálculo          | Comprovado por testes do pacote, API e web              |

### Interface

| Critérios                     | Estado        | Base reutilizável                                                                                                                      | Implementação esperada                                 |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `PREC-CA-054` a `PREC-CA-057` | `PARTIAL`     | Resumo, formulários, prévia, histórico e diálogo de adoção diferenciam mínimo, preço analisado, papéis, confirmação e erros acessíveis | Acabamento e validação integral do Marco 4E pendentes  |
| Recálculo local               | `IMPLEMENTED` | Web consome o pacote compartilhado, recalcula sem rede e possui prova síncrona representativa abaixo de 100 ms                         | Resultado local não é autoridade financeira            |
| Validação autoritativa        | `PARTIAL`     | Simulação, criação de versão e adoção são acionadas pela web sem enviar resultado calculado pelo cliente; backend valida a adoção      | Fluxo real integrado e inspeção em navegador pendentes |

### Auditoria e segurança

| Critérios                     | Estado        | Base reutilizável                                                                                                                          | Implementação esperada                    |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `PREC-CA-058`                 | `IMPLEMENTED` | Configuração, perfis, composição, versão, adoção e preço manual geram auditorias atômicas testadas                                         | Preservar nas integrações futuras         |
| `PREC-CA-059`                 | `IMPLEMENTED` | Evento imutável guarda a decisão e justificativa; AuditLog vinculado guarda organização, ator, produto, versão e preços                    | Comprovado por rollback e metadados E2E   |
| `PREC-CA-060`                 | `IMPLEMENTED` | DTO de adoção rejeita preço, classificação, fórmula, snapshot, IDs protegidos e resultados enviados pelo cliente                           | Preservar nas próximas mutações           |
| `PREC-CA-061`                 | `IMPLEMENTED` | Organização e ator vêm da sessão em todos os casos de uso; E2E cobre também preço manual, resumo e recursos externos                       | Preservar nas integrações futuras         |
| `PREC-RN-046` a `PREC-RN-048` | `IMPLEMENTED` | Prévia bloqueia divisor e divisões inválidas com erro tipado e separa visualmente entradas de campos calculados; API mantém erros estáveis | Comprovado no adaptador, painel e backend |

## 6. Rotas atuais que devem ser preservadas

A implementação não pode quebrar as rotas existentes, incluindo:

```text
/app/clientes
/app/clientes/novo
/app/clientes/:clientId
/app/produtos
/app/produtos/novo
/app/produtos/:productId
/app/financeiro
/app/financeiro/categorias
/app/financeiro/contas
/app/financeiro/lancamentos
/app/financeiro/lancamentos/novo
/app/financeiro/lancamentos/:entryId
/app/financeiro/orcamentos
/app/financeiro/orcamentos/novo
/app/financeiro/orcamentos/:quoteId
/app/financeiro/orcamentos/:quoteId/editar
/app/financeiro/pedidos
/app/financeiro/pedidos/fluxos
/app/financeiro/pedidos/:orderId
```

A rota de precificação deverá ser integrada ao domínio de produtos, evitando
transformá-la em uma área isolada do produto precificado.

## 7. Validações disponíveis

O repositório possui comandos para:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm db:status
```

Durante a implementação, também deverão ser executados testes direcionados dos
módulos alterados.

## 8. Regra para atualização da matriz

Ao concluir um requisito, o responsável deverá:

1. atualizar seu estado;
2. adicionar os caminhos dos arquivos implementados;
3. informar os testes que o validam;
4. registrar migrations relacionadas;
5. verificar impactos em requisitos adjacentes;
6. manter requisitos futuros sem marcá-los como concluídos.

Um requisito não deve ser marcado como `IMPLEMENTED` somente porque um arquivo
foi criado. O comportamento precisa estar funcional e validado.
