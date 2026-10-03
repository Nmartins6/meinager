# Critérios de aceitação da precificação

## 1. Finalidade

Este documento define os comportamentos verificáveis necessários para
considerar o domínio de precificação funcional.

Os critérios complementam:

- `business-rules.md`;
- `calculation-specification.md`;
- `examples.md`.

Os nomes de endpoints, componentes e tabelas poderão ser definidos durante o
planejamento técnico, mas não poderão alterar os comportamentos descritos aqui.

## 2. Escopo da primeira entrega

A primeira entrega deve permitir:

1. configurar parâmetros de precificação da organização;
2. cadastrar perfis de deduções de venda;
3. criar uma composição de custos para produto ou serviço;
4. simular preço mínimo e sugerido;
5. informar ou adotar um preço comercial;
6. salvar versões imutáveis dos cálculos;
7. consultar o histórico;
8. preservar snapshots em orçamentos e pedidos;
9. auditar ações financeiramente relevantes.

Não fazem parte obrigatória da primeira entrega:

- cálculo automático com base em lançamentos financeiros;
- comparação entre custo estimado e realizado;
- calendário;
- notificações;
- metas;
- ponto de equilíbrio no dashboard.

A arquitetura não deve impedir essas evoluções.

## 3. Configuração da organização

### PREC-CA-001 — Criar configuração

**Dado** que a organização ainda não possui configuração de precificação<br>
**Quando** um proprietário ou administrador informar os parâmetros válidos<br>
**Então** o sistema deve criar a configuração vinculada à organização<br>
**E** registrar o usuário e a data da alteração.

### PREC-CA-002 — Atualizar configuração

**Dado** que existe uma configuração de precificação<br>
**Quando** um proprietário ou administrador alterar seus parâmetros<br>
**Então** o sistema deve utilizar os novos valores somente em cálculos
posteriores<br>
**E** os cálculos históricos devem permanecer inalterados.

### PREC-CA-003 — Isolamento da configuração

**Dado** um usuário autenticado em uma organização<br>
**Quando** ele consultar ou alterar a configuração<br>
**Então** somente dados da organização autenticada podem ser utilizados.

Tentativas de acessar configurações de outra organização devem ser tratadas
como recurso não encontrado ou acesso não permitido, conforme o padrão atual
da API.

### PREC-CA-004 — Faturamento médio inválido

**Dado** que o percentual de custos fixos será calculado automaticamente<br>
**Quando** o faturamento mensal médio for zero<br>
**Então** o sistema deve rejeitar o cálculo<br>
**E** retornar o código `INVALID_AVERAGE_REVENUE`.

### PREC-CA-005 — Exibição dos valores derivados

**Dado** custo fixo mensal e faturamento médio válidos<br>
**Quando** a configuração for exibida<br>
**Então** o sistema deve apresentar o percentual de custos fixos calculado<br>
**E** identificar que esse percentual é derivado dos valores informados.

## 4. Perfis de deduções de venda

### PREC-CA-006 — Criar perfil

**Dado** um proprietário ou administrador<br>
**Quando** ele criar um perfil de venda<br>
**Então** poderá informar nome e uma coleção de deduções percentuais<br>
**E** o perfil deve pertencer à organização autenticada.

### PREC-CA-007 — Deduções extensíveis

**Dado** um perfil de venda<br>
**Quando** forem adicionadas deduções como imposto, cartão, comissão ou
marketplace<br>
**Então** o sistema deve preservar cada dedução individualmente<br>
**E** utilizar a soma delas no divisor.

### PREC-CA-008 — Nome identificável

**Dado** um perfil de venda<br>
**Quando** ele for salvo<br>
**Então** deve possuir um nome não vazio que permita sua identificação pelo
usuário.

### PREC-CA-009 — Perfil de outra organização

**Dado** um perfil pertencente a outra organização<br>
**Quando** seu identificador for usado em uma simulação ou composição<br>
**Então** o sistema deve rejeitar a operação sem expor seus dados.

## 5. Composição de custos

### PREC-CA-010 — Criar composição

**Dado** um produto ou serviço da organização<br>
**Quando** um usuário autorizado iniciar sua precificação<br>
**Então** deve ser possível criar uma composição com componentes de custo.

### PREC-CA-011 — Tipos de componentes

A composição deve aceitar, no mínimo:

- custo direto ou aquisição;
- materiais e insumos;
- embalagem;
- mão de obra;
- frete;
- terceirização;
- perdas;
- outros custos.

### PREC-CA-012 — Componentes opcionais

**Dado** que um produto não utiliza determinado componente<br>
**Quando** o cálculo for executado<br>
**Então** o componente ausente deve assumir valor zero<br>
**E** sua ausência não deve invalidar o cálculo.

### PREC-CA-013 — Quantidade e custo unitário

**Dado** um componente com quantidade e custo unitário<br>
**Quando** a composição for calculada<br>
**Então** seu total deve ser a multiplicação desses valores.

### PREC-CA-014 — Referência a item do catálogo

**Dado** um material ou insumo cadastrado no catálogo da organização<br>
**Quando** ele for utilizado na composição<br>
**Então** o cálculo deve preservar o identificador do item<br>
**E** copiar para o snapshot o custo utilizado.

### PREC-CA-015 — Alteração posterior do insumo

**Dado** um cálculo salvo que utiliza um item do catálogo<br>
**Quando** o custo atual do item for alterado<br>
**Então** o cálculo histórico não deve ser modificado.

Um novo cálculo poderá utilizar o custo atualizado.

### PREC-CA-016 — Valores negativos

**Quando** quantidade, custo, tempo, frete ou percentual negativo for informado<br>
**Então** o sistema deve rejeitar a entrada<br>
**E** identificar o campo inválido.

## 6. Mão de obra

### PREC-CA-017 — Cálculo automático

**Dado** custo mensal de mão de obra e horas produtivas válidas<br>
**Quando** o usuário informar o tempo necessário para o produto<br>
**Então** o sistema deve calcular o custo por hora, por minuto e do produto.

### PREC-CA-018 — Conversão de tempo

**Dado** que a interface aceita horas e minutos<br>
**Quando** o cálculo for executado<br>
**Então** o tempo deve ser convertido para minutos antes da multiplicação.

### PREC-CA-019 — Horas produtivas inválidas

**Dado** que a composição utiliza mão de obra automática<br>
**Quando** as horas produtivas mensais forem zero<br>
**Então** o cálculo deve ser rejeitado<br>
**E** retornar o código `INVALID_PRODUCTIVE_HOURS`.

Se a composição não utilizar mão de obra, essa validação não deve impedir o
cálculo.

## 7. Frete

### PREC-CA-020 — Rateio de frete

**Dado** valor total de frete e quantidade válida<br>
**Quando** o rateio for calculado<br>
**Então** o sistema deve dividir o frete pela quantidade<br>
**E** incorporar o resultado ao custo-base.

### PREC-CA-021 — Quantidade de rateio inválida

**Dado** que o rateio de frete está ativo<br>
**Quando** a quantidade for zero<br>
**Então** o sistema deve rejeitar o cálculo<br>
**E** retornar o código `INVALID_FREIGHT_QUANTITY`.

### PREC-CA-022 — Frete manual

**Dado** que não existe lote para rateio<br>
**Quando** o usuário informar frete unitário manual<br>
**Então** o sistema deve aceitar o valor<br>
**E** registrar sua origem como manual.

## 8. Simulação e cálculo

### PREC-CA-023 — Cálculo simples

**Dadas** as entradas do `EX-001`<br>
**Quando** o motor executar a simulação<br>
**Então** deve produzir os mesmos resultados definidos naquele exemplo.

### PREC-CA-024 — Cálculo completo

**Dadas** as entradas do `EX-002`<br>
**Quando** o motor executar a simulação<br>
**Então** deve produzir os mesmos resultados definidos naquele exemplo.

### PREC-CA-025 — Divisor inválido

**Quando** a soma de custos fixos percentuais, deduções e margem for igual ou
superior a 100%<br>
**Então** o sistema não deve produzir preço sugerido<br>
**E** deve retornar `INVALID_PRICING_DIVISOR`<br>
**E** deve orientar o usuário a revisar os percentuais.

### PREC-CA-026 — Decomposição do resultado

Um cálculo válido deve apresentar:

- custo-base;
- componentes do custo-base;
- percentual e valor de custos fixos;
- deduções individuais;
- total das deduções;
- preço mínimo;
- preço sugerido;
- margem desejada;
- lucro estimado;
- margem efetiva;
- desconto máximo;
- versão da fórmula.

### PREC-CA-027 — Recálculo da interface

**Dado** que o formulário possui entradas válidas<br>
**Quando** o usuário alterar um valor<br>
**Então** a prévia deve ser recalculada sem exigir salvamento<br>
**E** o resultado visual deve ser atualizado em até 100 ms em condições
normais no cliente.

A validação autoritativa deve continuar sendo executada pelo backend ao salvar.

### PREC-CA-028 — Backend autoritativo

**Dado** um resultado enviado pelo frontend<br>
**Quando** o cálculo for salvo<br>
**Então** o backend deve recalcular o resultado a partir das entradas<br>
**E** não deve confiar em totais ou preços calculados somente pelo cliente.

## 9. Preço adotado

### PREC-CA-029 — Adotar preço sugerido

**Dado** um cálculo válido<br>
**Quando** o usuário autorizado escolher o preço sugerido<br>
**Então** o preço comercial do produto deve ser atualizado explicitamente<br>
**E** a ação deve ser auditada.

### PREC-CA-030 — Informar preço diferente

**Dado** um cálculo válido<br>
**Quando** o usuário informar um preço diferente do sugerido<br>
**Então** o sistema deve recalcular lucro e margem efetiva<br>
**E** mostrar sua classificação em relação ao mínimo e ao sugerido.

### PREC-CA-031 — Preço entre o mínimo e o sugerido

**Dado** um preço adotado maior ou igual ao mínimo e menor que o sugerido<br>
**Quando** ele for analisado<br>
**Então** o sistema deve informar que existe resultado positivo<br>
**E** que a margem desejada não foi atingida.

### PREC-CA-032 — Preço abaixo do mínimo

**Dado** um preço adotado abaixo do preço mínimo<br>
**Quando** ele for analisado<br>
**Então** o sistema deve apresentar um alerta de prejuízo estimado<br>
**E** não pode tratá-lo como preço saudável.

### PREC-CA-033 — Autorização abaixo do mínimo

Somente proprietário ou administrador poderá confirmar a adoção de um preço
abaixo do mínimo.

A confirmação deve:

- ser explícita;
- solicitar uma justificativa;
- registrar preço, usuário, justificativa e cálculo de referência na auditoria.

Usuários de operações não poderão adotar preço abaixo do mínimo.

### PREC-CA-034 — Nenhuma alteração silenciosa

O sistema não deve atualizar o preço comercial do produto apenas porque:

- uma simulação foi executada;
- parâmetros globais foram alterados;
- um insumo teve seu custo atualizado;
- uma nova versão foi calculada.

A atualização requer uma ação explícita de adoção.

## 10. Versionamento e histórico

### PREC-CA-035 — Salvar versão

**Dado** um cálculo válido<br>
**Quando** o usuário salvar o cálculo<br>
**Então** uma nova versão imutável deve ser criada.

### PREC-CA-036 — Preservar versões anteriores

**Dado** que o produto possui versões salvas<br>
**Quando** uma nova versão for criada<br>
**Então** as versões anteriores devem continuar disponíveis e inalteradas.

### PREC-CA-037 — Memória do cálculo

Cada versão deve preservar:

- entradas;
- componentes;
- parâmetros globais utilizados;
- perfil de deduções utilizado;
- resultados exatos e comerciais;
- preço adotado, quando existente;
- versão da fórmula;
- organização;
- usuário responsável;
- data e hora.

### PREC-CA-038 — Histórico do produto

**Dado** um produto com versões de precificação<br>
**Quando** seu histórico for acessado<br>
**Então** as versões devem ser exibidas da mais recente para a mais antiga<br>
**E** deve ser possível identificar qual versão originou o preço atual.

## 11. Integrações

### PREC-CA-039 — Compatibilidade com produtos existentes

Produtos criados antes da funcionalidade devem continuar utilizáveis com seu
preço comercial atual, mesmo sem composição de precificação.

### PREC-CA-040 — Snapshot no orçamento

**Dado** um produto com preço adotado<br>
**Quando** ele for incluído em um orçamento<br>
**Então** o item deve preservar o preço e os dados comerciais utilizados<br>
**E** alterações posteriores no produto não devem modificar o orçamento.

A primeira entrega poderá preservar somente o identificador da versão e os
valores necessários, desde que o histórico permaneça reproduzível.

### PREC-CA-041 — Snapshot no pedido

**Dado** um orçamento convertido em pedido<br>
**Quando** o pedido for criado<br>
**Então** os snapshots dos itens devem ser preservados sem recálculo.

### PREC-CA-042 — Sem movimentação de estoque

Criar, simular ou salvar uma precificação não deve gerar movimentação de
estoque.

### PREC-CA-043 — Sem lançamento financeiro

Criar, simular ou salvar uma precificação não deve gerar automaticamente
contas a pagar, contas a receber ou baixas financeiras.

### PREC-CA-044 — Fluxos de pedidos preservados

A implementação da precificação não deve alterar o funcionamento dos fluxos
configuráveis de pedidos.

## 12. Permissões

### PREC-CA-045 — Configuração global

Somente os papéis `OWNER` e `ADMIN` podem:

- criar ou alterar parâmetros globais;
- criar ou alterar perfis de deduções;
- desativar configurações.

### PREC-CA-046 — Composição e preço

Os papéis `OWNER`, `ADMIN` e `OPERATIONS` podem:

- criar e alterar composições;
- executar simulações;
- salvar versões;
- adotar preços iguais ou superiores ao mínimo.

### PREC-CA-047 — Consulta

Papéis autenticados com acesso de leitura aos produtos podem consultar:

- preço comercial;
- resumo da precificação;
- histórico permitido pela política da organização.

A exposição do detalhamento de custos deverá respeitar as permissões definidas
pela API.

### PREC-CA-048 — Usuário somente leitura

O papel `VIEWER` não pode:

- alterar configurações;
- alterar composições;
- salvar versões;
- adotar preços.

### PREC-CA-049 — Acesso não autenticado

Requisições de precificação sem sessão autenticada devem retornar `401`.

## 13. Precisão e arredondamento

### PREC-CA-050 — Precisão decimal

Os resultados dos exemplos oficiais devem ser reproduzidos utilizando
aritmética decimal.

Testes não devem depender de tolerâncias próprias de ponto flutuante para
validar dinheiro.

### PREC-CA-051 — Preços comerciais

Preço mínimo e preço sugerido comerciais devem ser arredondados para cima até
o próximo centavo.

### PREC-CA-052 — Valores informativos

Valores monetários informativos devem ser exibidos com duas casas decimais,
sem alterar os valores intermediários utilizados pelo motor.

### PREC-CA-053 — Margem após arredondamento

Lucro e margem efetiva devem ser recalculados utilizando o preço comercial ou
adotado, e não apenas o preço exato anterior ao arredondamento.

## 14. Usabilidade e acessibilidade

### PREC-CA-054 — Diferenciação visual

A interface deve diferenciar claramente:

- campos editáveis;
- campos calculados;
- avisos;
- erros;
- resultados finais.

Essa diferenciação não deve depender somente de cores.

### PREC-CA-055 — Mensagens próximas da origem

Erros de validação devem ser apresentados próximos ao campo ou grupo que os
originou, além de impedir o salvamento inválido.

### PREC-CA-056 — Estados da operação

A interface deve comunicar estados de:

- carregamento;
- cálculo;
- salvamento;
- sucesso;
- erro;
- ausência de configuração;
- ausência de composição.

### PREC-CA-057 — Identificação do preço

O usuário deve conseguir distinguir:

- preço atual do produto;
- preço mínimo;
- preço sugerido;
- preço informado manualmente;
- margem efetiva.

## 15. Auditoria e segurança

### PREC-CA-058 — Auditoria das configurações

Criação e alteração de configurações e perfis devem gerar auditoria.

### PREC-CA-059 — Auditoria do preço adotado

A adoção ou substituição do preço comercial deve registrar:

- organização;
- usuário;
- produto;
- versão do cálculo;
- preço anterior;
- preço novo;
- data e hora;
- justificativa, quando exigida.

### PREC-CA-060 — Proteção contra manipulação

O backend deve ignorar resultados financeiros calculados pelo cliente e
recalculá-los a partir das entradas validadas.

### PREC-CA-061 — Isolamento nos relacionamentos

Identificadores de produto, insumo, perfil, configuração e versão devem ser
validados contra a organização autenticada.

## 16. Condição de conclusão da primeira entrega

A primeira entrega somente poderá ser considerada concluída quando:

1. os exemplos `EX-001` até `EX-012` estiverem cobertos por testes;
2. APIs possuírem testes de autenticação, autorização e isolamento;
3. produtos existentes continuarem funcionais;
4. o usuário puder configurar, compor, simular, salvar e adotar um preço;
5. o histórico permanecer imutável;
6. orçamentos e pedidos preservarem seus snapshots;
7. typecheck, lint, testes e build da API e da aplicação web forem aprovados;
8. migrations estiverem aplicáveis em banco novo e banco com dados existentes;
9. `git diff --check` não apresentar erros;
10. a matriz de rastreabilidade estiver atualizada.
