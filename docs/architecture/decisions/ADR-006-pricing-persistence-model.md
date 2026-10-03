# ADR-006 — Persistência, revisões e snapshots da precificação

- Status: aceito como direção arquitetural no Marco 2A; implementação pendente
- Data: 03/10/2026
- Domínio: precificação, produtos, orçamentos e pedidos
- Decisores: responsáveis pelo produto Meinager, após revisão da proposta do Marco 2A

## Contexto

O Marco 1 entregou o motor puro `margin-divisor-v1`, com 77 testes próprios e
98 testes unitários da API aprovados. A persistência ainda não existe.
Esta ADR registra a direção aprovada antes de modificar o schema ou gerar
migration; complementa ADR-001 a ADR-005, sem alterar fórmulas ou o motor.

`Product.directCost` usa `Decimal(18,6)` e `Product.salePrice` usa
`Decimal(14,2)`. Orçamentos e pedidos preservam snapshots comerciais e a
conversão copia seus valores sem consultar preços atuais. O motor pode produzir
resultados maiores e com mais casas do que os campos existentes suportam.

Configuração atual, composição editável, simulação, versão salva e adoção são
conceitos diferentes. Seus vínculos devem impedir referências entre
organizações e suas alterações não podem reinterpretar o histórico.

## Decisão

Adotar configuração e perfis com revisões imutáveis, composição atual editável,
versões de cálculo finalizadas e eventos imutáveis de adoção. Manter
`Product.salePrice` como preço comercial atual, com referência opcional à versão
que originou esse preço. Salvar composição, simular ou salvar versão não adota
preço nem escreve no estoque ou no financeiro.

### Vigência e precedência

A primeira entrega terá somente ativação explícita e imediata. Não haverá
agendamento nem seleção automática de revisões futuras. `effectiveFrom` será
definido pelo backend no momento da ativação, para configuração e perfil.

Alterar configuração ou perfil cria uma revisão imutável e move atomicamente
`currentRevisionId`. Numeração ocorre sob bloqueio da respectiva raiz. Criação
da raiz, primeira revisão e definição do ponteiro pertencem à mesma transação;
o ponteiro pode estar nulo somente durante essa construção interna.

`desiredMargin` da composição, quando informado, sobrescreve
`defaultDesiredMargin` da configuração. Zero informado é uma margem explícita.
Na ausência de ambos, rejeitar o cálculo, sem padrão financeiro implícito.
O perfil selecionado fornece as deduções. O snapshot registra os valores
efetivos, o nível de onde foram selecionados e suas origens.

### Entidades conceituais

Os nomes abaixo orientam o futuro schema. Todos os modelos novos possuem UUID,
`organizationId` obrigatório, timestamps e relações explícitas com organização.
Usar os mapeamentos snake_case e `Timestamptz(3)` existentes. Autoria deve ser
registrada e validada contra a sessão e o vínculo organizacional.

| Entidade                                   | Responsabilidade e campos principais                                                                                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OrganizationPricingConfiguration`         | Raiz única por organização; `currentRevisionId`, `isActive`, autoria e timestamps.                                                                                                                                   |
| `OrganizationPricingConfigurationRevision` | `configurationId`, `revision`, `effectiveFrom`, `currency`, modo `RATE`/`MONTHLY`, taxa ou custo fixo mensal/faturamento, custo mensal de mão de obra, horas produtivas, margem padrão e proveniência por parâmetro. |
| `PricingSalesProfile`                      | Identidade do perfil/canal, `currentRevisionId`, `isActive`, autoria e timestamps.                                                                                                                                   |
| `PricingSalesProfileRevision`              | `profileId`, `revision`, nome não vazio, `effectiveFrom`, autoria e deduções da revisão.                                                                                                                             |
| `PricingDeduction`                         | Dedução imutável de uma revisão de perfil: posição, nome, categoria textual extensível, taxa, origem e detalhes da origem.                                                                                           |
| `ProductPricingComposition`                | Composição atual única por produto: revisão crescente, perfil selecionado opcional, margem opcional, mão de obra e minutos canônicos, modo/entradas de frete, origens, `isActive` e autoria.                         |
| `PricingComponent`                         | Componente atual ordenado: descrição, categoria, unidade, quantidade, `costSource`, `sourceProductId` e `storedUnitCost` condicionais, detalhes da origem.                                                           |
| `PricingCalculationVersion`                | Produto, número crescente, referências e revisões utilizadas, snapshot canônico, estado estrutural, colunas-resumo, fórmula, contrato, moeda, autoria e finalização.                                                 |
| `PricingVersionComponent`                  | Projeção imutável dos componentes congelados: posição, descrição, categoria, unidade, quantidade, `effectiveUnitCost`, total, referência e origem.                                                                   |
| `PricingVersionDeduction`                  | Projeção imutável das deduções congeladas: posição, nome, categoria, taxa, valor no preço analisado e origem.                                                                                                        |
| `PricingPriceAdoption`                     | Evento imutável: produto, versão, preço anterior/novo, referência anterior quando existente, classificação do preço escolhido, ator, data, confirmação e justificativa quando exigidas.                              |

Simulações não salvas permanecem transitórias, sem tabela ou auditoria
individual. Salvar uma simulação cria uma versão. Insumos são produtos do
catálogo; componentes livres não exigem um novo cadastro de insumos.

Configuração, perfil e composição são desativados, não excluídos. Revisões
preservam conteúdo antigo; snapshots também preservam os parâmetros efetivos.
A edição da composição incrementa sua revisão sob bloqueio do produto.

### Semântica de custos dos componentes

`costSource` distingue `MANUAL`, `COPIED` e `CATALOG`:

| Fonte     | `storedUnitCost`          | `sourceProductId` | Fonte efetiva para novo cálculo                                        |
| --------- | ------------------------- | ----------------- | ---------------------------------------------------------------------- |
| `MANUAL`  | Obrigatório, não negativo | Nulo              | Custo informado e persistido.                                          |
| `COPIED`  | Obrigatório, não negativo | Nulo              | Custo copiado e persistido; a proveniência registra a origem da cópia. |
| `CATALOG` | Nulo                      | Obrigatório       | `Product.directCost` atual carregado pelo backend.                     |

A origem histórica de uma cópia pertence à proveniência, não a um vínculo
que atualize seu valor. Checks deverão impedir combinações contraditórias.

Para `CATALOG`, simulação e salvamento carregam o item da organização
autenticada, ativo e com `directCost` presente. Rejeitar item inexistente,
externo, inativo, sem custo ou igual ao produto da própria composição.
Custo nulo não significa zero; custo explicitamente zero é válido.

Não haverá conversão automática de unidades nem execução recursiva de
composições. A unidade usada deve ser compatível com a do item do catálogo;
na primeira entrega, usar a mesma unidade normalizada do cadastro. Conversões
ficam para evolução futura.

`effectiveUnitCost` é o valor resolvido pelo backend e congelado no snapshot
e em `PricingVersionComponent`. Para `MANUAL` e `COPIED`, vem de
`storedUnitCost`; para `CATALOG`, vem do `Product.directCost` atual.
`storedUnitCost` nunca funciona como cache para `CATALOG` e permanece nulo
nesse modo.

### Estratégia decimal e moeda

| Campos                                                                                                   | Representação persistida                                                                             |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Entradas gerais: custos, quantidades, horas e minutos; `storedUnitCost`; entradas copiadas nas projeções | Prisma `Decimal @db.Decimal(19,6)`, PostgreSQL `numeric(19,6)`.                                      |
| Taxas e margens informadas, inclusive deduções copiadas                                                  | Prisma `Decimal @db.Decimal(12,8)`, PostgreSQL `numeric(12,8)`, como frações.                        |
| Resultados exatos, taxas derivadas, margens calculadas e resultados comerciais potencialmente maiores    | `String @db.Text` ou strings em `Json @db.JsonB`.                                                    |
| `PricingPriceAdoption.previousPrice` e `newPrice`                                                        | `Decimal @db.Decimal(14,2)`, igual a `Product.salePrice`; preço anterior anulável, novo obrigatório. |
| `Product.salePrice` e valores comerciais existentes                                                      | Tipos atuais preservados, sem ampliação nesta entrega.                                               |

Resultados exatos podem exceder `Decimal(19,6)` em magnitude e escala.
Preservar a saída do motor como texto sem expoente; dízimas continuam sendo
aproximações determinísticas na precisão de trabalho da ADR-005. Não limitar
texto a 160 caracteres: dígitos significativos não equivalem ao comprimento
da representação decimal. Resultados negativos, como prejuízo, são válidos;
resultados não aplicáveis continuam `null`.

Todos os decimais dentro do JSON são strings. Contagens, revisões e outros
metadados não financeiros podem ser inteiros. Preços comerciais mantêm duas
casas; formatos informativos não voltam ao cálculo.

Validar sintaxe, escala, finitude e intervalo antes de converter e persistir
entradas. Não confiar em coerção de escala pelo PostgreSQL. É proibido qualquer
truncamento silencioso ou arredondamento para acomodar um campo insuficiente.
Os únicos arredondamentos financeiros são os já definidos na ADR-002/005.

Preço fora de `0` a `999999999999.99` pode ser preservado como resultado de
cálculo, mas não adotado em `Product.salePrice` ou no evento de adoção.
Validar centavos e intervalo do destino antes da escrita, sem usar `number`.
Não usar `Decimal(19,6)` nos preços de `PricingPriceAdoption`.

`margin-divisor-v1` suporta somente BRL. Persistir `currency` para evolução
futura. A migration deverá criar check que permita apenas `BRL` nas colunas
de moeda de configuração/versão e exigir coerência da moeda no snapshot.
Não inferir suporte a outra moeda a partir de `Organization.currency`.

### Snapshot canônico e projeções

`PricingCalculationVersion.snapshot` JSONB é a fonte histórica canônica e
contém `input`, `result` e `context`. O contrato tem versão explícita,
`snapshotSchemaVersion`, e validação de runtime antes de persistir ou utilizar
uma versão. `formulaVersion` é independente da versão do contrato.

Congelar todas as entradas resolvidas, a saída completa do motor e o contexto:

- identificação e dados do produto utilizados;
- componentes ordenados, quantidades, unidades, custos efetivos e referências;
- entradas e resultados de mão de obra e frete, inclusive consumo efetivo;
- modo e entradas originais de custos fixos, sem substituir valores mensais
  pela taxa derivada aproximada;
- configuração/perfil e revisões utilizados, vigência e deduções individuais;
- margem desejada efetivamente selecionada, sua precedência e origem;
- proveniência por parâmetro: `MANUAL`, `FINANCIAL_AGGREGATE` ou `COPIED`,
  fonte, janela/períodos, critério, data da apuração e confirmador aplicáveis;
- resultados exatos, comerciais e informativos, preço analisado, preço adotado
  informado quando houver, lucro, margem efetiva, desconto, classificação e avisos;
- moeda, fórmula, contrato, política decimal, data e responsável.

As origens de custo de componente também distinguem `CATALOG`. Metadados de
origem complementam o contrato do motor; não fazem o motor consultar fontes.

`PricingVersionComponent` e `PricingVersionDeduction` são projeções relacionais
imutáveis criadas do mesmo objeto tipado e na mesma transação. Servem para
consulta, índices e FKs. Não reconstruir o snapshot consultando cadastros
atuais nem permitir edição independente das projeções.

As colunas-resumo também são projeções, para listar histórico sem carregar
JSONB em cada linha:

| Coluna                                                                | Tipo proposto                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `minimumPriceCommercial`, `suggestedPriceCommercial`, `analyzedPrice` | `String @db.Text`, preços comerciais com duas casas.          |
| `classification`                                                      | Enum compatível com as cinco classificações do motor.         |
| `componentCount`, `deductionCount`                                    | `Int`, não negativos, correspondentes aos arrays do snapshot. |
| `formulaVersion`                                                      | `String @db.VarChar(60)`, identificador retornado pelo motor. |
| `snapshotSchemaVersion`                                               | `Int`, versão suportada do contrato.                          |
| `currency`                                                            | `String @db.Char(3)`, restrito a BRL nesta entrega.           |
| `finalizedAt`                                                         | `DateTime? @db.Timestamptz(3)`, obrigatório em `FINALIZED`.   |

### Ciclo BUILDING/FINALIZED e imutabilidade

Uma versão nasce internamente como `BUILDING`. Na mesma transação, o backend
insere snapshot, colunas-resumo e projeções. Antes de finalizar, valida o
contrato em runtime e verifica contagens, posições, vínculos e correspondência
básica dos campos das projeções e resumos com o snapshot.

A única transição é `BUILDING -> FINALIZED`; o backend define `finalizedAt`.
Somente versões `FINALIZED` podem ser retornadas, adotadas ou referenciadas.
Não existe estado de rascunho persistente nem retorno de uma versão em construção.

A implementação SQL deverá:

1. permitir construção e finalização somente dentro da transação criadora;
2. validar contagens, posições únicas e contínuas de 1 a N e correspondência básica na finalização;
3. impedir nova transição e qualquer `UPDATE`/`DELETE` da versão finalizada;
4. impedir `INSERT`/`UPDATE`/`DELETE` de projeções de versão finalizada;
5. impedir referência externa de produto, adoção ou item comercial a uma
   versão ainda `BUILDING`; as projeções internas podem vinculá-la durante
   a construção na mesma transação;
6. usar verificação diferida até o fim da transação para rejeitar commit que
   deixaria qualquer versão `BUILDING` persistida.

A verificação diferida deve consultar o estado final da linha, não apenas o
estado observado no evento inicial de inserção. Erro de construção ou de
finalização provoca rollback integral. A proteção de completude não duplica
as fórmulas em SQL; valida a estrutura e as projeções do resultado produzido.

Revisões de configuração/perfil e suas deduções, assim como eventos de adoção,
também não permitem atualização/exclusão de conteúdo histórico.

### FKs e isolamento

A organização vem da sessão, nunca do corpo do cliente. Além dos filtros da
aplicação, usar FKs compostas com combinações exatas de colunas únicas:

| Alvo                                       | Chave única necessária                                                                                                 | FK que a utiliza                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Product`                                  | `(organizationId, id)`, já existente                                                                                   | Composição, versão e referências ao catálogo.                                                                                                                 |
| `OrganizationPricingConfiguration`         | `(organizationId)` e `(organizationId, id)`                                                                            | Uma raiz por organização; revisões pertencem à raiz.                                                                                                          |
| `OrganizationPricingConfigurationRevision` | `(organizationId, configurationId, revision)` e `(organizationId, configurationId, id)`; também `(organizationId, id)` | Ponteiro da raiz: `(organizationId, id, currentRevisionId)` para `(organizationId, configurationId, id)`. Versões vinculam a revisão por organização/ID.      |
| `PricingSalesProfile`                      | `(organizationId, id)`                                                                                                 | Revisões e seleção de perfil da composição.                                                                                                                   |
| `PricingSalesProfileRevision`              | `(organizationId, profileId, revision)` e `(organizationId, profileId, id)`; também `(organizationId, id)`             | Ponteiro da raiz: `(organizationId, id, currentRevisionId)` para `(organizationId, profileId, id)`. Deduções e versões vinculam a revisão por organização/ID. |
| `ProductPricingComposition`                | `(organizationId, productId)` e `(organizationId, productId, id)`; também `(organizationId, id)`                       | Uma composição atual por produto; versão usa `(organizationId, productId, compositionId)` e componente usa organização/composição.                            |
| `PricingCalculationVersion`                | `(organizationId, productId, number)` e `(organizationId, productId, id)`; também `(organizationId, id)`               | Produto: `(organizationId, id, adoptedPricingVersionId)`; adoção: `(organizationId, productId, versionId)`; projeções: organização/versão.                    |
| Coleções ordenadas                         | `(organizationId, parentId, position)` em cada coleção                                                                 | Posição única em deduções, componentes atuais e projeções de versão.                                                                                          |

Todas as entidades novas possuem FK organizacional obrigatória. Referências
históricas usam `onDelete: Restrict`, inclusive às raízes, produtos e revisões.
A referência anterior de versão no evento de adoção, quando presente, também
precisa provar organização e produto.

Raízes podem ter ponteiro nulo durante sua inserção, mas não ao concluir a
transação de criação. A implementação deverá verificar esse fechamento.
Mudança de ponteiro não altera a revisão antiga. IDs em proveniência JSON,
quando resolvidos, também devem ser verificados pela aplicação; JSON não é
substituto para FKs ou autorização. Não criar vínculos relacionais por ID
isolado que permitam referências entre organizações.

No Marco 5, referências opcionais de itens comerciais deverão provar
organização/produto/versão. Um item sem produto não pode possuir referência de
versão; somente versões finalizadas poderão ser vinculadas.

### Concorrência e ordem de bloqueios

Revisões de configuração e perfil são numeradas sob bloqueio da entidade raiz.
Editar composição, numerar versão ou adotar preço exige bloqueio do produto,
reutilizando a coordenação de `lockProduct` com o cadastro e o estoque.
Unicidade no banco é a última proteção; nunca usar `max + 1` sem bloqueio.

A futura API de edição da composição receberá `expectedRevision`. Sob bloqueio,
comparará esse valor com a revisão atual e rejeitará edição desatualizada,
sem sobrescrever dados. Alteração válida incrementa a revisão atomicamente.

Quando uma operação precisar de mais de um bloqueio, a ordem única será:

1. raiz de configuração organizacional;
2. raízes de perfis de venda, por UUID crescente;
3. produtos, por UUID crescente.

Operações que usam apenas um desses recursos podem adquirir só seu bloqueio.
Determinar o conjunto necessário antes de bloquear. Se uma releitura exigir
um bloqueio de classe anterior ou fora da ordem, abortar/reiniciar a transação;
não inverter a ordem. Revisões imutáveis permitem capturar parâmetros sem
manter bloqueios de escrita desnecessários. Ler os custos do catálogo de forma
consistente, sem bloquear ou calcular composições recursivamente.

Criação de versão e adoção devem preservar integralmente a operação vencedora,
com preço, referência, evento e auditoria consistentes. Tratamento de conflitos
e retries não pode duplicar efeitos de uma transação que já foi confirmada.

### Adoção e preço manual

Uma versão só pode ser adotada se finalizada e pertencente ao mesmo produto e
organização. O backend valida o contrato, reconstrói e reexecuta as entradas
congeladas com a fórmula suportada e verifica sua consistência com o snapshot.
Fórmula ou contrato não suportado bloqueia adoção, sem reinterpretar resultados.
Configurações e custos atuais não substituem as entradas congeladas.

Uma versão existente só pode ser reutilizada na adoção quando o preço
escolhido for exatamente igual ao `analyzedPrice` congelado nessa versão,
por comparação decimal. Em uma versão sem preço manual, `analyzedPrice`
normalmente corresponde a `suggestedPriceCommercial`, permitindo reutilização.

Se `suggestedPriceCommercial` for diferente de `analyzedPrice`, adotar o
sugerido exige nova execução com esse preço como `adoptedPrice` e criação de
uma nova versão. Qualquer outro preço diferente de `analyzedPrice` também
exige novo cálculo e nova versão.

A classificação, decomposição, deduções, lucro e margem congelados na versão
devem corresponder ao preço efetivamente adotado. `PricingPriceAdoption` deve
referenciar a versão que contém a análise do `newPrice`. Nunca modificar a
versão anterior para acomodar outra adoção.

Validar intervalo de `Decimal(14,2)`, centavos e permissões antes da adoção.
Preço abaixo do mínimo exige `OWNER`/`ADMIN`, confirmação explícita e
justificativa. Salvar preço, referência, evento de adoção e auditoria na mesma
transação; registrar preço anterior/novo, ator, produto, versão e justificativa.

Se o `PATCH` de produto receber explicitamente `salePrice`, inclusive `null`
ou valor numericamente igual ao atual, sua origem passa a ser manual e
`adoptedPricingVersionId` é limpo. A omissão de `salePrice` preserva valor e
origem. Essa integração deverá auditar a mudança; não é implementada nesta ADR.
Eventos e versões anteriores permanecem preservados.

### Retenção, migrations e limpeza de testes

Configurações, perfis e composições são desativados. Revisões, versões,
projeções e adoções não têm exclusão física na primeira entrega. FKs
`onDelete: Restrict` protegem histórico; não usar cascade para remover versões.

A migration será aditiva, preservando preços atuais e referências nulas em
produtos antigos, sem composição fictícia ou cálculo retroativo. Não recalcular
orçamentos/pedidos nem modificar migrations já aplicadas.

Testar migrations em bancos descartáveis dedicados, tanto vazios quanto com
dados do baseline. A limpeza de dados protegidos será feita descartando o banco
ou schema isolado de teste, por infraestrutura com credencial administrativa
separada da aplicação. Antes da limpeza, verificar explicitamente que o alvo é
descartável e exclusivo da suíte. Não executar essa limpeza nesta etapa.

Os testes da proteção SQL precisam usar uma credencial sujeita aos mesmos
guards de escrita da aplicação. Não desabilitar triggers para os testes de
imutabilidade, não criar endpoint de limpeza, não adicionar bypass condicionado
a `NODE_ENV` em funções de produção e não dar à aplicação permissão para remover
triggers ou tabelas. Migrations usam credencial administrativa separada e
mantêm a proteção ao evoluir contratos; não removem histórico para facilitar
uma nova migration. Eventual retenção futura exige outra decisão revisada.

### Autorização futura — Marco 3

| Papel            | Leitura e escrita de precificação                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OWNER`, `ADMIN` | Leitura e escrita completas; abaixo do mínimo exige confirmação e justificativa.                                                                      |
| `OPERATIONS`     | Leitura completa; escrita de composição, simulação, versão e adoção igual/acima do mínimo. Não altera configuração/perfis nem adota abaixo do mínimo. |
| `FINANCE`        | Leitura completa de custos, decomposição e histórico; sem escrita.                                                                                    |
| `VIEWER`         | Somente dados comerciais já autorizados; sem custos, margens, lucro, decomposição ou histórico interno.                                               |

Todas as operações exigem sessão e isolamento. Contratos comerciais de
orçamento/pedido não expandem custos ou resultados internos. A política acima
orienta os novos endpoints e suas seleções explícitas, não somente a interface.

**Política existente a revisar separadamente:** o contrato atual de `Product`
ainda expõe `directCost` ao `VIEWER`. Esta ADR não altera esse contrato nem
retira acesso silenciosamente. Sua revisão deverá ser explícita, com análise
de compatibilidade e testes, antes de considerar uniforme a proteção de custos
entre catálogo e precificação.

## Consequências positivas

- Histórico autossuficiente, reproduzível e protegido contra mudanças retroativas.
- Cada adoção referencia a versão cuja análise congelada corresponde exatamente ao preço efetivamente adotado.
- Componentes de catálogo usam custo atual em novos cálculos e custo congelado no histórico.
- Precisão preservada mesmo em resultados maiores que os campos comerciais.
- FKs comprovam organização e pertencimento dos ponteiros e referências.
- Listagens podem usar resumos sem carregar toda a memória de cálculo.
- Edição desatualizada de composição é rejeitada explicitamente.
- Configuração manual continua possível sem dependência de histórico financeiro.

## Custos e riscos

- Snapshot, projeções e resumos duplicam dados; precisam de validação e testes de correspondência.
- Adotar preço diferente de `analyzedPrice` exige nova execução e versão, inclusive quando o preço escolhido é o sugerido comercial da versão anterior.
- Triggers, verificações diferidas e FKs compostas exigem SQL revisável e testes reais de transação.
- Numeração e movimentação de ponteiros exigem bloqueios, ordem consistente e tratamento de conflitos.
- Proteção de exclusão muda a limpeza dos testes e impede remoção livre de organizações com histórico.
- Texto decimal não permite ordenação financeira lexicográfica; consultas numéricas futuras precisam de estratégia própria.
- Fórmulas/contratos antigos precisam permanecer suportados para adoção; leitura histórica não pode migrar resultados silenciosamente.
- A exposição atual de `directCost` no catálogo continua uma diferença de política a revisar.

## Alternativas descartadas

- Usar `Decimal(19,6)` para todos os resultados: perde escala ou impede preservar cálculos válidos.
- Usar `Decimal(19,6)` no evento de adoção: diverge do intervalo e da escala de `Product.salePrice`.
- Ampliar o preço comercial existente nesta entrega: aumenta o escopo de compatibilidade.
- Custo persistido obrigatório como fonte atual de componente `CATALOG`: pode ficar desatualizado.
- Histórico dependente de relações com valores atuais: modifica a interpretação de cálculos antigos.
- JSON sem relações/projeções verificáveis: reduz garantias de isolamento e rastreabilidade.
- Alterar versão finalizada ao adotar: viola imutabilidade; eventos de adoção são separados.
- Persistir toda prévia, aceitar versões `BUILDING` fora da transação ou expor limpeza de histórico na API.
- Agendar configuração futura, converter unidades automaticamente ou inferir taxas do financeiro na primeira entrega.

## Itens explicitamente fora do Marco 2

- Endpoints, DTOs HTTP, serviços de casos de uso e aplicação dos guards aos novos contratos: Marco 3.
- Integração funcional com o `PATCH` manual e operações de adoção: API posterior, usando a estrutura definida aqui.
- Interface e prévia local compartilhada: Marco 4.
- Validação de origem em orçamento e cópia de referência em pedido: Marco 5.
- Integração automática de agregados financeiros, conversão de unidades, agendamento, retenção com exclusão e novas moedas.
- Alteração de fórmulas, resultados canônicos ou arquitetura matemática do Marco 1.

No Marco 2A atual, também estão fora: qualquer alteração de schema, migration,
código, dependências, banco ou estados da matriz de rastreabilidade.

## Pontos ainda abertos

- Contrato final do snapshot e seus validadores/guards SQL, a implementar após revisão.
- Semântica de seleção antiga, preço manual e descontos na origem comercial dos itens do Marco 5.
- Revisão explícita da exposição existente de `Product.directCost` ao `VIEWER`.
- Compartilhamento da prévia com a web e integrações financeiras futuras.

As decisões de vigência imediata, precedência, fonte de custos, preço manual,
adoção, representação decimal, leitura por papel e edição com `expectedRevision`
estão confirmadas nesta ADR; não permanecem ambiguidades de negócio dessas regras.
