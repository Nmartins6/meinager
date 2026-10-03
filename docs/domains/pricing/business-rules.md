# Regras de negócio da precificação

## 1. Finalidade

Este documento define as regras oficiais do domínio de precificação do
Meinager.

As regras se aplicam a produtos e serviços e devem ser respeitadas pelo
backend, frontend, banco de dados e testes automatizados.

As fórmulas detalhadas, escalas decimais e regras de arredondamento são
definidas em `calculation-specification.md`.

## 2. Terminologia

Para este domínio:

- **Composição de custos:** conjunto de componentes necessários para produzir,
  adquirir ou prestar um produto ou serviço.
- **Custo-base:** soma dos custos unitários informados em reais antes das
  deduções percentuais incidentes sobre a venda.
- **Custo direto:** valor de aquisição ou produção diretamente associado ao
  produto.
- **Custo fixo:** despesa da organização que não depende diretamente da
  quantidade vendida no período.
- **Percentual de custo fixo:** relação entre custos fixos mensais e faturamento
  mensal médio.
- **Dedução de venda:** percentual que incide sobre o preço final, como imposto,
  taxa de pagamento ou comissão.
- **Margem desejada:** parcela pretendida de lucro sobre o preço final.
- **Preço mínimo:** preço que cobre o custo-base, custos fixos e deduções de
  venda, sem incluir margem de lucro desejada.
- **Preço sugerido:** preço calculado com a margem de lucro desejada.
- **Preço adotado:** preço comercial escolhido pelo usuário.
- **Snapshot:** cópia imutável dos dados e resultados utilizados em determinado
  cálculo, orçamento ou pedido.
- **Versão de cálculo:** registro histórico de uma execução salva do motor de
  precificação.

## 3. Configuração da organização

### PREC-RN-001 — Isolamento por organização

Toda configuração, composição, cálculo e histórico de precificação deve
pertencer a uma organização.

Uma organização não pode consultar nem utilizar dados de precificação de outra
organização.

### PREC-RN-002 — Parâmetros configuráveis

O sistema não deve possuir valores financeiros, percentuais, salários, custos
ou margens de exemplo fixados como regras globais.

Cada organização deve informar ou obter de seus próprios dados:

- custo fixo mensal;
- faturamento mensal médio;
- custo mensal de mão de obra;
- horas produtivas mensais;
- impostos;
- taxas de pagamento;
- comissões;
- margem desejada;
- outros componentes aplicáveis.

### PREC-RN-003 — Origem dos parâmetros

Um parâmetro poderá ter origem:

- manual;
- calculada a partir do módulo financeiro;
- copiada de uma configuração anterior.

O sistema deve registrar a origem utilizada no cálculo.

Na primeira versão, parâmetros ainda não integrados ao financeiro poderão ser
informados manualmente.

### PREC-RN-004 — Vigência

Configurações de precificação devem possuir data de início de vigência.

Alterar uma configuração não pode modificar versões de cálculo, orçamentos ou
pedidos criados anteriormente.

### PREC-RN-005 — Faturamento médio

O faturamento mensal médio deve ser maior que zero quando for utilizado para
calcular o percentual de custos fixos.

A janela de apuração e a origem do faturamento devem ficar registradas na
configuração ou no snapshot do cálculo.

## 4. Composição do custo-base

### PREC-RN-006 — Componentes suportados

O custo-base poderá incluir:

- materiais;
- insumos;
- mercadorias para revenda;
- consumíveis;
- embalagem;
- mão de obra direta;
- frete ou transporte rateado;
- terceirização;
- perdas ou desperdícios;
- outros custos unitários em reais.

Componentes não utilizados devem assumir valor zero.

### PREC-RN-007 — Motor único

O sistema deve utilizar um único motor de cálculo.

As modalidades simples, com frete, com mão de obra ou completa devem ser
representadas pela presença ou ausência de componentes, sem duplicação das
fórmulas centrais.

### PREC-RN-008 — Quantidade e custo unitário

Um componente poderá possuir quantidade e custo unitário.

Seu custo total deve ser calculado pela multiplicação desses valores.

O cálculo salvo deve preservar quantidade, unidade, custo unitário e custo
total utilizados.

### PREC-RN-009 — Referência a produtos e insumos

Um componente poderá referenciar um produto ou insumo cadastrado no catálogo.

O valor utilizado deve ser copiado para o snapshot. Alterações posteriores no
item referenciado não podem modificar cálculos históricos.

### PREC-RN-010 — Custos adicionais

O usuário poderá informar componentes de custo não vinculados ao catálogo,
desde que possuam descrição, valor e categoria identificável.

### PREC-RN-011 — Valores negativos

Custos, quantidades, tempos e percentuais não podem ser negativos.

Componentes com valor zero poderão ser aceitos durante a edição, mas não devem
aumentar o custo-base.

## 5. Mão de obra

### PREC-RN-012 — Custo mensal de mão de obra

O custo mensal de mão de obra poderá considerar:

- salário;
- encargos;
- benefícios;
- provisões;
- outros custos relacionados ao trabalho.

A aplicação poderá aceitar o custo mensal consolidado ou apresentar campos
auxiliares para sua composição.

### PREC-RN-013 — Horas produtivas

O custo por hora deve utilizar as horas produtivas mensais informadas pela
organização.

As horas produtivas mensais devem ser maiores que zero para que o custo de mão
de obra seja calculado automaticamente.

### PREC-RN-014 — Tempo do produto

O tempo de produção ou execução deve ser armazenado em uma unidade canônica,
preferencialmente minutos.

A interface poderá aceitar horas e minutos, convertendo-os antes do cálculo.

### PREC-RN-015 — Mão de obra unitária

O custo de mão de obra do produto deve resultar da multiplicação entre o tempo
necessário e o custo da mão de obra por minuto.

O valor utilizado deve ser preservado no snapshot.

## 6. Frete e transporte

### PREC-RN-016 — Rateio por lote

O frete poderá ser rateado pela quantidade de itens de um lote, compra,
recebimento ou envio.

A quantidade utilizada no rateio deve ser maior que zero.

### PREC-RN-017 — Frete manual

Quando não houver lote registrado, o usuário poderá informar diretamente o
frete unitário estimado.

O snapshot deve identificar se o valor foi rateado ou informado manualmente.

## 7. Custos fixos

### PREC-RN-018 — Percentual de custos fixos

O percentual de custos fixos deve representar a relação entre o custo fixo
mensal e o faturamento mensal médio da organização.

### PREC-RN-019 — Incidência sobre a receita

Quando representado como percentual do faturamento, o custo fixo deve incidir
sobre o preço final e participar do divisor da formação de preço.

Ele não deve ser multiplicado pelo custo direto nem adicionado novamente ao
custo-base.

### PREC-RN-020 — Estratégias alternativas

Uma futura estratégia de custo fixo unitário poderá adicionar um valor em reais
ao custo-base.

A mesma execução não poderá utilizar simultaneamente o percentual de custos
fixos no divisor e o custo fixo unitário no numerador.

## 8. Deduções incidentes sobre a venda

### PREC-RN-021 — Deduções percentuais

O sistema deve suportar deduções percentuais incidentes sobre o preço final,
incluindo:

- impostos;
- taxas de pagamento;
- comissões;
- taxas de marketplace;
- outras deduções de venda.

### PREC-RN-022 — Perfis de venda

A organização poderá manter perfis de dedução para diferentes canais ou meios
de pagamento.

Exemplos de perfis possíveis incluem venda direta, cartão, marketplace ou
outros canais definidos pela organização.

Os nomes e percentuais devem ser configuráveis.

### PREC-RN-023 — Preservação das deduções

O cálculo deve preservar individualmente cada dedução utilizada, mesmo que o
motor também utilize sua soma.

## 9. Formação do preço

### PREC-RN-024 — Metodologia

O preço deve ser calculado pelo método de margem divisora, também conhecido
como markup por dentro.

Custos fixos percentuais, deduções de venda e margem desejada devem incidir
sobre o preço final.

### PREC-RN-025 — Limite matemático

A soma do percentual de custos fixos, deduções de venda e margem desejada deve
ser estritamente menor que 100%.

Quando a soma for igual ou superior a 100%, o sistema deve considerar o cálculo
inviável e não deve produzir preço sugerido.

### PREC-RN-026 — Preço mínimo

O preço mínimo deve cobrir:

- custo-base;
- percentual de custos fixos;
- deduções incidentes sobre a venda.

O preço mínimo não deve incluir margem de lucro desejada.

### PREC-RN-027 — Preço sugerido

O preço sugerido deve cobrir:

- custo-base;
- percentual de custos fixos;
- deduções incidentes sobre a venda;
- margem de lucro desejada.

### PREC-RN-028 — Preço adotado

O usuário poderá adotar:

- o preço sugerido;
- um preço arredondado;
- um preço informado manualmente.

O sistema não deve substituir silenciosamente o preço adotado.

### PREC-RN-029 — Análise do preço adotado

Para um preço adotado diferente do sugerido, o sistema deve recalcular e
apresentar:

- valor destinado a cada dedução;
- valor destinado à cobertura dos custos fixos;
- lucro estimado;
- margem efetiva;
- diferença para o preço sugerido;
- relação com o preço mínimo.

### PREC-RN-030 — Preço abaixo do mínimo

O sistema deve alertar quando o preço adotado estiver abaixo do preço mínimo.

A política de permitir ou bloquear essa escolha deverá ser definida nos
critérios de aceitação e nas permissões do domínio.

### PREC-RN-031 — Desconto máximo

O sistema poderá informar o desconto máximo aplicável ao preço sugerido sem
reduzir o valor final abaixo do preço mínimo.

## 10. Resultado e explicação

### PREC-RN-032 — Decomposição do preço

O resultado deve apresentar separadamente:

- custo-base;
- cada componente de custo em reais;
- valor destinado à cobertura de custos fixos;
- cada dedução de venda;
- lucro estimado;
- preço mínimo;
- preço sugerido;
- preço adotado;
- margem desejada;
- margem efetiva.

### PREC-RN-033 — Memória de cálculo

O sistema deve permitir compreender como cada resultado foi obtido.

A memória de cálculo deve preservar entradas, resultados, configuração,
fórmula ou versão do motor e data do cálculo.

### PREC-RN-034 — Recálculo em edição

Alterações nos campos de entrada devem atualizar a simulação apresentada ao
usuário sem exigir o salvamento de cada alteração.

A persistência deve ocorrer apenas mediante ação explícita de salvar, calcular
ou adotar o preço, conforme definido pela interface.

## 11. Versionamento e histórico

### PREC-RN-035 — Versionamento

Cada cálculo salvo deve gerar uma versão identificável e imutável.

Uma nova execução não deve sobrescrever versões anteriores.

### PREC-RN-036 — Snapshot de orçamento

Ao adicionar um produto ou serviço a um orçamento, o sistema deve preservar os
dados comerciais e de precificação necessários naquele item.

Mudanças futuras no produto não podem alterar o orçamento existente.

### PREC-RN-037 — Snapshot de pedido

Ao converter um orçamento em pedido, seus snapshots devem ser preservados.

Mudanças futuras no produto, na composição ou na configuração de precificação
não podem alterar o pedido existente.

### PREC-RN-038 — Auditoria

Criação e alteração de configurações, adoção de preço e outras ações
financeiramente relevantes devem produzir registros de auditoria com
organização, usuário, entidade, ação e metadados essenciais.

## 12. Integração com o financeiro

### PREC-RN-039 — Custos fixos financeiros

O módulo financeiro poderá fornecer o total de despesas classificadas como
custos fixos dentro de um período definido.

A classificação e o período utilizados devem ser rastreáveis.

### PREC-RN-040 — Receita considerada

Receitas utilizadas em indicadores realizados devem respeitar o regime
adotado pelo sistema.

Enquanto a regra oficial considerar recebimento, somente valores efetivamente
recebidos devem compor receita realizada.

### PREC-RN-041 — Estimado versus realizado

A arquitetura deve permitir comparar futuramente:

- custo estimado na precificação;
- custo registrado ou movimentado durante a execução;
- preço vendido;
- valor efetivamente recebido;
- resultado estimado;
- resultado realizado.

Essa comparação não precisa fazer parte da primeira entrega do motor, mas os
snapshots não podem impedir sua implementação futura.

## 13. Compatibilidade com funcionalidades existentes

### PREC-RN-042 — Catálogo

O produto deve continuar possuindo um preço comercial utilizável pelo catálogo,
orçamentos e demais funcionalidades existentes.

A implementação da precificação deve complementar esse preço, não remover o
comportamento atual sem migração planejada.

### PREC-RN-043 — Estoque

A criação ou atualização de uma precificação não deve gerar movimentações de
estoque.

### PREC-RN-044 — Financeiro

Uma simulação ou cálculo de preço não deve criar lançamentos financeiros
automaticamente.

### PREC-RN-045 — Pedidos e fluxos

A precificação não deve alterar o funcionamento dos fluxos configuráveis de
pedidos.

## 14. Mensagens e validações

### PREC-RN-046 — Divisor inválido

Quando a soma dos percentuais atingir ou ultrapassar 100%, o sistema deve
bloquear o cálculo e apresentar uma mensagem equivalente a:

> A soma dos percentuais de custos, taxas e margem deve ser menor que 100%.
> Revise os valores para calcular um preço válido.

### PREC-RN-047 — Divisão por zero

O sistema deve impedir cálculos que dependam de faturamento, horas produtivas
ou quantidade de rateio iguais a zero.

A mensagem deve identificar qual parâmetro precisa ser corrigido.

### PREC-RN-048 — Campos calculados

A interface deve diferenciar campos informados pelo usuário de valores
calculados automaticamente.

Campos calculados não devem aceitar edição direta, exceto quando houver uma
ação explícita para substituir o valor sugerido por um valor manual.
