# Manual de uso do Meinager

## Antes de começar

No Windows, se o responsável configurou os atalhos, dê dois cliques em
**Meinager** na área de trabalho. Aguarde o navegador abrir e mantenha a janela
do servidor aberta durante o uso. O ícone **Manual Meinager** abre este manual
mesmo sem internet. Para encerrar o sistema, salve seu trabalho e pressione
`Ctrl+C` na janela do servidor. Fechar só a aba do navegador não o desliga.

Com o programa iniciado pelo responsável, abra <http://localhost:5173>.
Crie sua conta e sua empresa no primeiro acesso. Nas próximas vezes, entre com
e-mail e senha. Confira sempre o nome da organização ativa.

Guarde sua senha com segurança. Esta versão ainda não oferece recuperação de
senha por e-mail; em caso de perda, procure o responsável pela instalação.

O percurso recomendado é **custos → insumos → produtos e preços → clientes →
orçamentos → pedidos → financeiro e estoque**. Na página inicial, clique em
**Cadastrar custos, insumos e produtos**. O cadastro guiado reúne as primeiras
etapas em uma tela. Ele está disponível ao
proprietário e aos administradores. Seus seis blocos separam custos fixos,
variáveis e regras do preço; correspondem às três partes do setup abaixo.

Cada botão salva o respectivo cadastro. Não existe um único botão para salvar
toda a página. Aguarde a confirmação antes de continuar. Dados já salvos
permanecem; campos ainda não salvos podem se perder ao fechar ou recarregar.
Para retomar um produto existente, abra-o em **Produtos**, evitando criar
outro cadastro no formulário inicial.

Nos campos numéricos, use ponto para os decimais e não digite `R$` nem separador
de milhares: `1250.50` significa R$ 1.250,50. Campos percentuais da interface
usam `10` para 10%. Todos os exemplos deste manual são fictícios.

## Etapa 1 — Setup inicial: custos e regras de preço

Separe uma lista de despesas fixas, despesas variáveis gerais, materiais,
tempo de produção, taxas de venda e margem desejada.

### Registrar despesas

1. Abra **Cadastre e forme seu preço** pelo cadastro guiado.
2. Em custos fixos, crie uma **competência**: o mês e ano do acompanhamento.
   Prefira somar lançamentos de receita quando for registrar cada receita.
   Faturamento manual é uma alternativa para informar o total do mês.
3. Cadastre uma categoria, como Aluguel ou Internet.
4. Selecione a competência e categoria, informe descrição, valor e vencimento
   dentro do mês escolhido e clique em **Registrar despesa**.
5. Repita para as outras despesas e para custos variáveis gerais.

Registrar uma despesa não significa que ela foi paga. A baixa do pagamento é
feita depois no Financeiro. Despesas não se repetem automaticamente no mês
seguinte: abra a competência e cadastre os novos lançamentos.

### Configurar a formação do preço

Os lançamentos financeiros **não são importados automaticamente para a fórmula**.
No bloco **Como formar o preço**, informe e salve:

- **Custos fixos:** percentual informado ou valores mensais. No modo mensal,
  o sistema divide custo fixo mensal pelo faturamento médio mensal informado.
  Exemplo: R$ 1.000 / R$ 10.000 corresponde a 10%. O faturamento deve ser maior
  que zero; confira se a estimativa representa a realidade da empresa.
- **Mão de obra:** custo mensal e horas produtivas mensais. O tempo usado em
  cada produto será informado na composição dele.
- **Margem desejada padrão:** participação desejada do lucro no preço de venda.
- **Perfis de venda:** impostos, comissão e taxas percentuais do canal, quando
  existirem. Crie perfis diferentes para canais com deduções diferentes e
  selecione o adequado na composição do produto.

Não conte o mesmo gasto duas vezes na fórmula. Se a energia já está no rateio
de custos fixos, não a acrescente integralmente de novo como componente.
Materiais consumidos em cada unidade entram na composição. O registro da
compra no Financeiro serve ao controle financeiro e não acrescenta custo ao
cálculo automaticamente.

## Etapa 2 — Cadastro de insumos

No bloco **Insumos e serviços usados no produto**, informe nome, unidade e
custo por unidade de consumo e clique em **Cadastrar insumo**. Repita para
caneca branca, camiseta, papel, embalagem e outros materiais ou serviços.

Insumos compartilham o catálogo de Produtos; não há um estoque de insumos
separado. Use nomes claros, como “Insumo — Caneca branca”.

Escolha a unidade e mantenha-a consistente. Exemplo: um pacote de 100 folhas
por R$ 50 corresponde a custo `0.50` por folha, se o cadastro usar uma folha
como unidade. Para consumir meia folha na composição, informe quantidade
`0.5`. O sistema não converte pacote, folha, metro, quilo ou área automaticamente.

Não é necessário definir preço de venda para um material usado internamente.
Para controlar estoque, abra o cadastro completo em Produtos, habilite o
controle e registre as movimentações correspondentes.

## Etapa 3 — Cadastro de produtos e preço sugerido

1. Cadastre o produto acabado no bloco **Produto, composição e preço sugerido**
   ou em **Produtos → Novo**.
2. Monte a composição de **uma unidade vendida**. Adicione cada componente com
   nome, quantidade e origem do custo. Para usar o insumo cadastrado, selecione
   a origem de catálogo e o item correspondente.
3. Inclua embalagem, serviços e outros custos diretos. Informe tempo de mão de
   obra quando aplicável e configure frete manual ou rateado, se houver.
4. Escolha o perfil de venda e revise a margem desejada.
5. Salve a composição e confira a prévia: preço mínimo, sugerido e resultado.
6. Clique em **Confirmar simulação no servidor**, depois em **Salvar versão**.
7. Adote a versão desejada e confirme a adoção. Confira o preço comercial do
   produto antes de preparar o orçamento.

**Simular não altera o preço de venda.** A adoção é uma decisão explícita.
Um preço manual também é possível no resumo comercial, mas passa a ter origem
manual. A venda abaixo do mínimo requer permissão e confirmação; revise o
prejuízo indicado antes de aceitar.

### Como interpretar o cálculo

O custo-base reúne componentes, mão de obra e frete aplicáveis. Custos fixos,
deduções e margem são parcelas do preço, e não um simples acréscimo sobre o
custo. Exemplo fictício: custo-base R$ 10, custos fixos 10%, sem taxas e margem
25% resultam em `10 / (1 - 0.10 - 0.25)`, com sugestão comercial **R$ 15,39**.
O mínimo, sem essa margem, é **R$ 11,12**. Os preços comerciais são arredondados
para cima no centavo para não ficar abaixo do valor calculado.

Nos resultados, `≈` indica um percentual aproximado para leitura, limitado a
duas casas decimais. Os cálculos e as versões salvas mantêm a precisão completa.

Se a soma de custos fixos, taxas e margem inviabilizar o divisor, revise os
parâmetros. Não reduza custos reais apenas para fazer o sistema aceitar.

Quando um insumo mudar de preço, atualize seu custo e gere uma nova simulação
e versão dos produtos afetados. Revise e adote os novos preços. Não há
reprecificação automática em lote. Versões antigas preservam os custos usados
na época; orçamentos e pedidos existentes mantêm seus valores históricos.

## Etapa 4 — Clientes

Cadastre o cliente no último bloco do cadastro guiado ou em **Clientes**.
Informe nome, tipo e, quando disponíveis, documento, telefone, e-mail e
observações. Procure clientes existentes antes de cadastrar novamente.
Use os contatos reais apenas na organização correta.

## Etapa 5 — Orçamentos

1. Abra **Financeiro → Orçamentos → Novo**, ou **Criar orçamento** no guia.
2. Escolha o cliente, adicione produtos, quantidades e revise os valores.
3. Confira descontos, validade e observações disponíveis no formulário.
4. Salve o orçamento. Ele fica registrado como rascunho para conferência.
5. Quando encaminhá-lo ao cliente, use **Enviar orçamento** para registrar a
   mudança de status. Essa ação não envia e-mail ou WhatsApp automaticamente.
6. Registre a aprovação ou recusa do cliente. Um orçamento aprovado pode ser
   convertido em pedido.

Para simular preço sem criar documento, use a precificação do produto. Salvar
um orçamento cria um registro comercial. Confira preços antes de enviá-lo:
alterações posteriores no catálogo não atualizam esse documento. Preços de
origem calculada preservam a referência da versão aplicável; custos internos
não devem ser copiados nas observações destinadas ao cliente.

## Etapa 6 — Pedido e acompanhamento

No orçamento aprovado, clique em **Criar pedido**. O pedido preserva os itens
e valores do orçamento. Acompanhe as etapas do fluxo operacional e registre
as transições conforme o trabalho avança.

O responsável pode configurar os fluxos em **Pedidos → Fluxos**. Uma sequência
útil para produção sob encomenda é aprovação, preparação, produção e entrega,
adaptada às etapas e transições permitidas pelo sistema.

Criar ou avançar um pedido não dá baixa automática nos insumos nem registra
automaticamente recebimentos. Faça esses registros nas respectivas áreas.

## Etapa 7 — Financeiro e estoque

No Financeiro, mantenha categorias, competências e contas organizadas.
Registre receitas e despesas; quando o dinheiro efetivamente entrar ou sair,
registre a baixa na conta correspondente. Confira recebimentos parciais,
saldos e vencimentos. O resumo depende da origem do faturamento escolhida;
resultado do mês não é necessariamente saldo disponível em caixa.

Nos produtos com estoque, registre entradas, saídas, ajustes de contagem e
eventuais estornos. A composição de preço não representa uma ordem automática
de consumo de materiais. Confira o saldo físico regularmente.

Ao fechar um mês, revise lançamentos e baixas antes de encerrar a competência.
Não use cancelamentos ou ajustes apenas para esconder divergências.

## Pessoas e rotina de conferência

O proprietário administra convites em **Membros**. Compartilhe o link privado
com a pessoa correta; ela deve usar conta própria, aceitar o convite e entrar
na organização. Os botões disponíveis variam conforme o papel; uma restrição
de acesso deve ser resolvida pelo responsável, sem compartilhar senhas.

No início do dia, confira pendências financeiras e pedidos. Ao fim, revise
pagamentos, recebimentos e estoque e solicite o backup ao responsável.
Mensalmente, revise custos, taxas, produtividade e margens antes de adotar
novos preços.

## Evoluções sugeridas

Para simplificar a rotina, as próximas melhorias recomendadas são despesas
recorrentes, ajuda com unidades de compra/consumo, revisão dos produtos afetados
por aumento de insumos e geração de documento para compartilhar o orçamento.
Integração automática de custos, estoque e financeiro exige regras próprias e
não deve ser presumida no uso desta versão.
