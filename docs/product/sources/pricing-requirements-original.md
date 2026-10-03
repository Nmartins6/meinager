# Requisitos originais de precificação

## Finalidade deste documento

Este documento preserva os requisitos e as ideias inicialmente levantadas
para o sistema de precificação e para a evolução do Meinager.

Seu conteúdo funciona como material de origem para análise. As regras aqui
descritas não são necessariamente as regras oficiais do sistema, pois podem
conter duplicidades, ambiguidades ou fórmulas posteriormente revisadas.

As regras oficiais devem ser consultadas nos documentos localizados em:

- `docs/domains/pricing/business-rules.md`
- `docs/domains/pricing/calculation-specification.md`
- `docs/domains/pricing/acceptance-criteria.md`

## Histórico

- Origem: levantamento inicial baseado na planilha de precificação.
- Registrado em: 02/10/2026.
- Estado: material de referência.
- Aplicação direta no código: não permitida sem validação nos documentos oficiais.

---

# Documento original 1 — Sistema de Precificação de Produtos

Este documento apresenta a **Especificação de Requisitos Funcionais e Não Funcionais** para o desenvolvimento do **Sistema de Precificação Inteligente de Produtos**, elaborado a partir da análise detalhada da estrutura lógica e das fórmulas matemáticas da planilha de cálculo de preço de venda.-----# Documento de Requisitos de Software: Sistema de Precificação de Produtos## 1\. Visão Geral e ObjetivoO objetivo do sistema é calcular o **Preço de Venda Ideal** de produtos e serviços utilizando a metodologia de **Margem Divisora (Markup por dentro)**. O sistema considera custos diretos do produto, embalagem, rateio proporcional de custos fixos da empresa, custos de mão de obra direta (calculados por hora/minuto) e rateio de despesas de transporte/frete, garantindo a cobertura de impostos, taxas financeiras (cartão) e a margem de lucro desejada sobre a receita bruta.-----## 2\. Regras de Negócio (RN) * **RN-01 (Rateio de Custo Fixo):** O custo fixo operacional da empresa é rateado proporcionalmente à representatividade do custo fixo sobre o faturamento médio mensal. O valor em R$ do custo fixo atribuído ao produto é proporcional ao seu custo direto.

- **RN-02 (Custo de Mão de Obra):** O valor da hora e do minuto trabalhados é obtido pela divisão do salário base pelas horas mensais contratadas. O custo de MDO do produto é calculado pela soma dos tempos (horas e minutos) dedicados à sua produção/execução.
- **RN-03 (Metodologia de Precificação - Markup sobre Venda):** Todas as alíquotas (Impostos, Taxas de Cartão/Marketplace e Margem de Lucro) incidem sobre o **Preço de Venda Final** (preço bruto) e não sobre o custo.
- **RN-04 (Limite de Margens/Deduções):** A soma das alíquotas percentuais ($\\text{Imposto %} + \\text{Taxa Cartão %} + \\text{Lucro %}$) deve ser estritamente **menor que 100%** ($1,00$). Se for igual ou superior a $100%$, a operação é matematicamente inviável (preço tenderia ao infinito ou seria negativo).-----## 3\. Requisitos Funcionais (RF)### RF-001: Seleção da Modalidade da Calculadora * **Descrição:** O sistema deve permitir que o usuário ative ou desative módulos de cálculo conforme a necessidade do produto.
- **Módulos Suportados:**
  1.  Precificação Simples (Custo do Produto + Custo Fixo + Embalagem).
  2.  Precificação com Rateio de Frete/Transporte.
  3.  Precificação com Mão de Obra (MDO).
  4.  Precificação Completa (Mão de Obra + Frete/Transporte).-----### RF-002: Gestão de Parâmetros Globais de Custo Fixo * **Entradas de Dados:**
  - `Custo Fixo Mensal` (R$)
  - `Faturamento Mensal Médio` (R$)
- **Processamento / Fórmulas:**
  - $\\text{Percentual de Rateio Custo Fixo (%)} = \\frac{\\text{Custo Fixo Mensal}}{\\text{Faturamento Mensal Médio}}$
- **Saída:** Percentual (%) a ser aplicado sobre o custo direto dos produtos.-----### RF-003: Gestão de Parâmetros Globais de Mão de Obra (MDO) * **Entradas de Dados:**
  - `Salário Base` (R$)
  - `Horas Trabalhadas no Mês` (Horas, ex: 220)
- **Processamento / Fórmulas:**
  - $\\text{Custo MDO por Hora (R$)} = \\frac{\\text{Salário Base}}{\\text{Horas Trabalhadas no Mês}}$
  - $\\text{Custo MDO por Minuto (R$)} = \\frac{\\text{Custo MDO por Hora}}{60}$
- **Saída:** Custo da mão de obra por hora e por minuto.-----### RF-004: Gestão de Parâmetros Globais de Frete / Transporte * **Entradas de Dados:**
  - `Quantidade de Produtos no Lote/Envio` (unidades)
  - `Valor Total do Custo de Envio` (R$)
- **Processamento / Fórmulas:**
  - $\\text{Rateio de Frete por Unidade (R$)} = \\frac{\\text{Valor Total do Custo de Envio}}{\\text{Quantidade de Produtos}}$
- **Saída:** Custo unitário de frete a ser incorporado no produto.-----### RF-005: Cadastro e Cálculo de Custo Total do Produto * **Entradas do Produto:**
  - `Custo Direto do Produto` (R$)
  - `Custo de Embalagem` (R$)
  - `Horas Trabalhadas no Produto` (Horas) _(Módulo MDO)_
  - `Minutos Trabalhados no Produto` (Minutos) _(Módulo MDO)_
- **Processamento do Custo Total:**
  1.  $\\text{Valor Custo Fixo alocado (R$)} = \\text{Custo Direto do Produto} \\times \\text{Percentual de Rateio Custo Fixo (%)}$
  2.  $\\text{Custo MDO em Horas (R$)} = \\text{Horas Trabalhadas no Produto} \\times \\text{Custo MDO por Hora}$
  3.  $\\text{Custo MDO em Minutos (R$)} = \\text{Minutos Trabalhados no Produto} \\times \\text{Custo MDO por Minuto}$
  4.  $\\text{Custo Total de MDO (R$)} = \\text{Custo MDO em Horas} + \\text{Custo MDO em Minutos}$
  5.  $\\text{Custo Total do Produto (R$)} = \\text{Custo Direto} + \\text{Valor Custo Fixo} + \\text{Embalagem} + \\text{Rateio de Frete} + \\text{Custo Total MDO}$
- **Saída:** Resumo detalhado do custo de produção/aquisição do produto.-----### RF-006: Entrada de Alíquotas e Deduções de Venda * **Entradas do Usuário:**
  - `Imposto sobre a Venda` (%)
  - `Taxa de Cartão / Meios de Pagamento` (%)
  - `Margem de Lucro Desejada` (%)
- **Validação:** Garantir que $\\text{Imposto %} + \\text{Taxa Cartão %} + \\text{Lucro %} \< 100%$.-----### RF-007: Cálculo do Preço de Venda Final * **Processamento / Fórmula Central:**
  $$\\text{Preço de Venda (R$)} = \\frac{\\text{Custo Total do Produto (R$)}}{1 - (\\text{Imposto %} + \\text{Taxa Cartão %} + \\text{Lucro Desejado %})}$$
- **Saída:** Preço de venda final sugerido.-----### RF-008: Decomposição e Detalhamento da Receita * **Processamento / Fórmulas:**
  - $\\text{Valor do Imposto (R$)} = \\text{Preço de Venda} \\times \\text{Imposto %}$
  - $\\text{Valor da Taxa de Cartão (R$)} = \\text{Preço de Venda} \\times \\text{Taxa Cartão %}$
  - $\\text{Valor do Lucro (R$)} = \\text{Preço de Venda} \\times \\text{Lucro Desejado %}$
- **Saída:** DRE simplificado (Demonstração do Resultado) do produto indicando o destino de cada real cobrado no preço de venda.-----## 4\. Requisitos Não Funcionais (RNF) * **RNF-001 (Precisão Numérica):**

  - Os cálculos intermediários (como valor da MDO por minuto e taxa de rateio de custo fixo) devem manter precisão de no mínimo **6 casas decimais** em memória.
  - Os valores finais exibidos ao usuário na interface de cobrança devem ser arredondados para **2 casas decimais** padrão monetário (R$).

- **RNF-002 (Reatividade e Desempenho):**

  - Toda alteração nos campos de entrada (inputs) deve recatular instantaneamente em tempo real (tempo de resposta do motor de cálculo $\< 100\\text{ms}$).

- **RNF-003 (Usabilidade e Design de Interface):**

  - A interface deve diferenciar claramente visualmente os **campos editáveis pelo usuário** (dados de entrada) dos **campos calculados automaticamente** (somente leitura).

- **RNF-004 (Validação de Erros e Mensagens de Feedback):**

  - O sistema deve proibir a digitação de números negativos para custos ou horas.
  - Caso o usuário informe alíquotas cuja soma seja igual ou superior a $100%$, o sistema deve bloquear o campo de preço e exibir a mensagem: _"A soma dos percentuais (Impostos + Taxa + Lucro) deve ser menor que 100% para evitar prejuízo indisponível."_

- **RNF-005 (Extensibilidade e Arquitetura):**

  - A estrutura de código deve permitir adicionar novos canais de venda (ex.: comissão de marketplace de 15% a 20%) inserindo novos campos de deduções no divisor do preço sem quebrar a lógica existente.

---

# Documento original 2 — Sistema de Gestão Inteligente para Microempresas

# Documento de Requisitos de Software: Sistema de Gestão Inteligente para Microempresas

## 1. Visão Geral e Objetivo

O objetivo do sistema é fornecer uma plataforma completa e genérica de gestão para microempresas de diversos nichos. O sistema centraliza o controle financeiro (contas a pagar e receber), gestão de clientes, controle de pedidos, calendário de lembretes e um painel estratégico (dashboard). O coração financeiro da plataforma é o seu módulo de **Precificação Inteligente**, que calcula o Preço de Venda Ideal garantindo a lucratividade e o ponto de equilíbrio do negócio.

## 2. Regras de Negócio Globais (RN)

### Módulo de Precificação (Markup por dentro)

- **RN-01 (Rateio de Custo Fixo):** O custo fixo operacional da empresa é rateado proporcionalmente à representatividade do custo fixo sobre o faturamento médio mensal. O valor em R$ do custo fixo atribuído ao produto é proporcional ao seu custo direto.
- **RN-02 (Custo de Mão de Obra):** O valor da hora e do minuto trabalhados é obtido pela divisão do salário base pelas horas mensais contratadas. O custo de MDO do produto é calculado pela soma dos tempos (horas e minutos) dedicados à sua produção/execução.
- **RN-03 (Metodologia de Precificação - Markup sobre Venda):** Todas as alíquotas (Impostos, Taxas de Cartão/Marketplace e Margem de Lucro) incidem sobre o Preço de Venda Final (preço bruto) e não sobre o custo.
- **RN-04 (Limite de Margens/Deduções):** A soma das alíquotas percentuais ($\text{Imposto %} + \text{Taxa Cartão %} + \text{Lucro %}$) deve ser estritamente menor que 100% ($1,00$). Se for igual ou superior a $100%$, a operação é matematicamente inviável.

### Módulos de Gestão

- **RN-05 (Ponto de Equilíbrio):** O cálculo para a empresa "se pagar" deve considerar a soma de todas as despesas fixas cadastradas no mês vigente, dividida pela Margem de Contribuição média das vendas realizadas.
- **RN-06 (Baixa Financeira):** Um pedido só pode ser contabilizado como "Receita Realizada" no dashboard após a confirmação do recebimento no módulo financeiro.

---

## 3. Requisitos Funcionais (RF)

### MÓDULO 1: Precificação Inteligente de Produtos

- **RF-001: Seleção da Modalidade da Calculadora**
  - _Descrição:_ O sistema deve permitir que o usuário ative/desative módulos de cálculo: Precificação Simples, Rateio de Frete, Mão de Obra (MDO), ou Completa.
- **RF-002: Gestão de Parâmetros Globais de Custo Fixo**
  - _Fórmula:_ $\text{Percentual de Rateio Custo Fixo (%)} = \frac{\text{Custo Fixo Mensal}}{\text{Faturamento Mensal Médio}}$
- **RF-003: Gestão de Parâmetros Globais de Mão de Obra (MDO)**
  - _Fórmulas:_
    - $\text{Custo MDO por Hora (R$)} = \frac{\text{Salário Base}}{\text{Horas Trabalhadas no Mês}}$
    - $\text{Custo MDO por Minuto (R$)} = \frac{\text{Custo MDO por Hora}}{60}$
- **RF-004: Gestão de Parâmetros Globais de Frete / Transporte**
  - _Fórmula:_ $\text{Rateio de Frete por Unidade (R$)} = \frac{\text{Valor Total do Custo de Envio}}{\text{Quantidade de Produtos}}$
- **RF-005: Cadastro e Cálculo de Custo Total do Produto**
  - _Fórmulas:_
    - $\text{Valor Custo Fixo alocado (R$)} = \text{Custo Direto} \times \text{Percentual de Rateio Custo Fixo (%)}$
    - $\text{Custo MDO em Horas/Minutos (R$)} = \text{Tempo Trabalhado} \times \text{Custo MDO por Hora/Minuto}$
    - $\text{Custo Total do Produto (R$)} = \text{Custo Direto} + \text{Valor Custo Fixo} + \text{Embalagem} + \text{Rateio Frete} + \text{Custo MDO}$
- **RF-006: Entrada de Alíquotas e Deduções de Venda**
  - _Validação:_ Garantir que $\text{Imposto %} + \text{Taxa Cartão %} + \text{Lucro %} < 100\%$.
- **RF-007: Cálculo do Preço de Venda Final**
  - _Fórmula Central:_
    $$\text{Preço de Venda (R$)} = \frac{\text{Custo Total do Produto (R$)}}{1 - (\text{Imposto %} + \text{Taxa Cartão %} + \text{Lucro Desejado %})}$$
- **RF-008: Decomposição e Detalhamento da Receita**
  - _Saída:_ DRE simplificado indicando Valor do Imposto (R$), Taxa (R$) e Lucro (R$) multiplicados pelo Preço de Venda.

### MÓDULO 2: Gestão Financeira

- **RF-101: Cadastro de Contas a Pagar e Receber:** O sistema deve permitir o registro de despesas e receitas, classificando-as como Fixas ou Variáveis.
- **RF-102: Recorrência de Lançamentos:** Permitir que contas fixas sejam configuradas para repetição mensal automática.
- **RF-103: Baixa de Títulos:** Funcionalidade para marcar uma conta como "Paga" ou "Recebida", atualizando o fluxo de caixa atual.

### MÓDULO 3: Calendário e Lembretes

- **RF-201: Visualização em Calendário:** O sistema deve exibir uma visão mensal/semanal destacando vencimentos de contas, datas de entrega de pedidos e reuniões/agendamentos com clientes.
- **RF-202: Sistema de Notificações:** Gerar alertas (in-app ou push) para contas a vencer nos próximos 3 dias e metas prestes a expirar.

### MÓDULO 4: Clientes e Pedidos

- **RF-301: Cadastro de Clientes (CRM Básico):** Registrar dados de contato, histórico de pedidos e valor total já gasto pelo cliente na empresa (LTV).
- **RF-302: Gestão de Pedidos/Orçamentos:** Permitir a criação de pedidos vinculando um Cliente e Produtos (com preços gerados pelo RF-007).
- **RF-303: Status do Pedido:** O pedido deve transitar entre status (ex: Orçamento, Aprovado, Em Produção, Concluído, Cancelado).

### MÓDULO 5: Painel Administrativo (Dashboard)

- **RF-401: Indicador de Ponto de Equilíbrio (Break-even):** O painel deve exibir em tempo real o valor exato que falta faturar no mês para que a empresa cubra todas as contas fixas e variáveis já cadastradas.
- **RF-402: Acompanhamento de Metas:** O usuário pode definir uma meta de faturamento ou lucro mensal, e o sistema mostrará uma barra de progresso.
- **RF-403: Resumo de Caixa:** Exibição rápida de Saldo Atual, Total a Receber no mês e Total a Pagar no mês.

---

## 4. Requisitos Não Funcionais (RNF)

- **RNF-001 (Precisão Numérica):** Os cálculos intermediários devem manter precisão de no mínimo 6 casas decimais. Valores finais devem ser arredondados para 2 casas decimais padrão monetário (R$).
- **RNF-002 (Reatividade e Desempenho):** Toda alteração nos inputs de precificação deve recalcular instantaneamente (tempo de resposta $< 100\text{ms}$).
- **RNF-003 (Usabilidade/Design):** A interface deve diferenciar claramente campos editáveis (dados de entrada) de campos calculados (somente leitura).
- **RNF-004 (Validação de Erros):**
  - Proibir números negativos para custos/horas.
  - Bloquear o campo de preço e exibir erro caso a soma de deduções atinja $100\%$: _"A soma dos percentuais deve ser menor que 100% para evitar prejuízo."_
- **RNF-005 (Extensibilidade):** A arquitetura deve permitir adicionar novos canais de venda (ex: comissão de marketplace) inserindo deduções no divisor do preço sem quebrar a lógica.
- **RNF-006 (Segurança e Nuvem):** O sistema deve funcionar em ambiente web/cloud, com dados criptografados em repouso e backups diários para proteção dos dados financeiros da empresa.
