# ADR-003 — Versionamento de cálculos e snapshots de precificação

- Status: aceito
- Data: 02/10/2026
- Domínio: precificação, produtos, orçamentos e pedidos
- Decisores: responsáveis pelo produto Meinager

## Contexto

Custos, taxas, margens, preços de insumos e parâmetros organizacionais mudam
com o tempo.

Se os resultados históricos forem recalculados utilizando os valores atuais,
o sistema poderá modificar retroativamente:

- preço sugerido;
- lucro estimado;
- margem;
- custo-base;
- valores utilizados em orçamentos;
- valores utilizados em pedidos.

O Meinager já preserva snapshots comerciais nos itens de orçamentos e pedidos.
A precificação deve complementar esse comportamento sem transformar documentos
históricos em referências dinâmicas ao cadastro atual.

Também é necessário distinguir:

- composição atual do produto;
- simulação ainda não salva;
- versão de cálculo salva;
- preço comercial adotado;
- snapshot do orçamento;
- snapshot do pedido.

## Decisão

Cada cálculo salvo deve gerar uma versão imutável.

Uma versão de cálculo não poderá ser alterada depois de criada. Qualquer
recálculo deverá criar uma nova versão.

A versão deverá preservar todas as informações necessárias para explicar e
reproduzir o resultado sem consultar valores atuais mutáveis.

## Composição atual

O produto ou serviço poderá possuir uma composição atual editável.

A composição atual representa a estrutura que será utilizada em uma próxima
simulação. Ela não representa, por si só, um cálculo histórico.

Alterar a composição atual não poderá modificar:

- versões salvas;
- preço comercial adotado;
- orçamentos existentes;
- pedidos existentes.

## Simulação

Uma simulação ainda não salva poderá existir apenas durante a requisição ou na
interface.

Ela não precisa gerar registro permanente nem auditoria individual.

Quando uma simulação for:

- salva;
- utilizada para adotar um preço;
- vinculada a uma ação financeiramente relevante;

o backend deverá recalculá-la e criar uma versão imutável.

## Conteúdo da versão

Cada versão deverá preservar, no mínimo:

### Identificação

- identificador;
- organização;
- produto ou serviço;
- número ou sequência da versão;
- versão da fórmula;
- moeda;
- data e hora;
- usuário responsável.

### Componentes

- descrição;
- categoria;
- quantidade;
- unidade;
- custo unitário;
- custo total;
- origem do custo;
- identificador do item referenciado, quando houver;
- valor copiado do item no momento do cálculo.

### Mão de obra

- custo mensal considerado;
- horas produtivas;
- custo por hora;
- custo por minuto;
- tempo utilizado;
- custo unitário de mão de obra.

### Frete

- modo manual ou rateado;
- valor total;
- quantidade utilizada;
- valor unitário resultante.

### Configuração

- custo fixo mensal;
- faturamento médio;
- percentual de custos fixos;
- origem e período dos valores;
- perfil de venda utilizado;
- deduções individuais;
- margem desejada.

### Resultados

- custo-base;
- preço mínimo exato;
- preço mínimo comercial;
- preço sugerido exato;
- preço sugerido comercial;
- preço adotado, quando existente;
- lucro estimado;
- margem efetiva;
- desconto máximo;
- avisos e classificações.

## Preço comercial do produto

O produto deve continuar possuindo um preço comercial atual.

Esse preço poderá ser:

- informado manualmente sem cálculo;
- adotado a partir de uma versão de precificação;
- substituído posteriormente por outra versão ou valor manual.

Quando o preço for adotado a partir de uma versão, o produto deverá manter uma
referência opcional para a versão que originou o preço atual.

Essa referência não substitui o valor monetário atual do produto.

## Adoção de preço

Adotar um preço deverá:

1. validar novamente as entradas no backend;
2. criar ou identificar uma versão imutável;
3. registrar o preço anterior;
4. atualizar explicitamente o preço comercial do produto;
5. relacionar o produto à versão adotada;
6. criar auditoria;
7. preservar eventual justificativa.

Apenas executar ou visualizar uma simulação não poderá atualizar o preço.

## Orçamento

Ao adicionar um produto ou serviço a um orçamento, o item deve preservar os
dados comerciais já exigidos pelo domínio de orçamentos, incluindo:

- descrição;
- unidade;
- quantidade;
- preço unitário;
- total;
- observações aplicáveis.

Quando o preço tiver origem em uma versão de precificação, o item poderá
preservar também o identificador dessa versão.

O orçamento não deverá consultar novamente o preço atual do produto para
recalcular itens já existentes.

## Pedido

Ao converter um orçamento em pedido, os snapshots comerciais devem ser
copiados para os itens do pedido.

O pedido não deve executar novamente o motor de precificação durante a
conversão.

A referência à versão de precificação, quando existente, deve ser preservada
para rastreabilidade.

## Separação entre dados internos e comerciais

Custos, margens e decomposições são informações internas da organização.

Os contratos destinados ao cliente não devem expor automaticamente:

- custo de aquisição;
- custo de mão de obra;
- custos fixos;
- margem;
- lucro;
- decomposição interna.

Orçamentos e pedidos preservam o preço comercial, mas o detalhamento interno
deve ser retornado somente por endpoints autorizados do domínio de
precificação.

## Exclusão e desativação

Versões de cálculo referenciadas não poderão ser excluídas fisicamente.

Configurações, perfis e composições já utilizados deverão ser:

- desativados;
- substituídos por nova versão;
- mantidos para rastreabilidade.

Uma política futura de retenção deverá preservar os requisitos legais,
financeiros e de auditoria antes de remover qualquer histórico.

## Alteração de parâmetros

Alterar configuração global, perfil de venda, insumo ou composição deverá
afetar apenas novas simulações.

O sistema poderá informar que existe uma versão desatualizada, mas não deverá
recalculá-la nem substituir o preço atual automaticamente.

## Numeração das versões

As versões devem possuir ordem crescente por produto dentro da organização.

Exemplo:

```text
Produto A — versão 1
Produto A — versão 2
Produto B — versão 1
```

A criação concorrente deve impedir números repetidos para o mesmo produto.

A identificação técnica principal continuará utilizando UUID.

## Concorrência

A adoção concorrente de preços deverá manter consistência entre:

- preço comercial atual;
- versão adotada;
- auditoria.

A operação deverá ser transacional.

Se duas adoções ocorrerem simultaneamente, o resultado final deverá
corresponder integralmente a uma única versão, sem combinar dados das duas.

## Auditoria

Devem ser auditadas:

- criação de versão salva;
- adoção de preço;
- substituição de preço adotado;
- adoção abaixo do mínimo;
- desativação de configuração ou perfil utilizado.

A auditoria deverá referenciar a entidade relevante e preservar metadados
suficientes para identificar a mudança.

## Migração e compatibilidade

Produtos existentes sem versões de precificação devem continuar válidos.

Na implantação inicial:

- o preço comercial existente será preservado;
- não será criada uma composição fictícia;
- não será inventado um cálculo retroativo;
- a referência para versão de precificação permanecerá nula;
- o usuário poderá criar a primeira composição posteriormente.

Orçamentos e pedidos existentes não deverão ser recalculados nem alterados.

## Consequências positivas

- Histórico reproduzível.
- Proteção contra mudanças retroativas.
- Auditoria do preço atual.
- Compatibilidade com orçamentos e pedidos existentes.
- Possibilidade futura de comparar estimado e realizado.

## Consequências e custos

- Maior volume de dados históricos.
- Necessidade de modelos específicos para versões e componentes.
- Configurações utilizadas não poderão ser removidas livremente.
- Consultas deverão distinguir composição atual de versões salvas.
- A adoção de preço deverá envolver transação.
