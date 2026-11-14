# Verificação de liberação local — 12–13/11/2026

## Escopo

Revisão da árvore de trabalho baseada em `9fbc384`, incluindo as alterações
preexistentes de cadastro guiado, produtos e indicadores. O arquivo de revisão
compactado preexistente foi preservado fora da entrega do programa.

Esta entrega prepara uso local por uma organização, com instalação assistida.
Não é instalador desktop nem homologação de hospedagem pública. A instalação
na máquina final depende do checklist do [guia local](installation.md).

**Parecer em 13/11/2026: apto para instalação local assistida da árvore
revisada.** Não ficaram bloqueadores funcionais nos percursos testados. Antes
de liberar dados reais, confirme instalação, reinicialização, persistência e
backup/restauração na máquina do usuário. O aceite se refere aos arquivos
revisados nesta entrega, e não a uma versão remota anterior.

## Correções e preparação

### Atalhos Windows — 14/11/2026

Adicionados instalador de atalhos PowerShell, launcher e script WSL de início.
O launcher aguarda Docker/health/web antes de abrir o navegador; o script WSL
usa lock para evitar dois processos de inicialização. O manual é copiado para
HTML local, com texto escapado. Instalação inicial, migrations e build continuam
sob responsabilidade do instalador, conforme [guia](installation.md).

Validação executada em Linux: `bash -n`, `git diff --check` e ensaio isolado
com comandos substitutos para instalação incompleta, ordem banco/aplicação
e lock de segunda execução. Não houve início nem alteração do banco real nesse
ensaio. PowerShell, atalhos, Docker Desktop e encaminhamento localhost do WSL
precisam ser validados no Windows final; não são homologados pelos testes Linux.

### Complemento exploratório — 14/11/2026

Mantido o parecer de aptidão para instalação local assistida, após corrigir
perda do aviso de rascunho ao abrir múltiplos formulários, validação de contatos
inválidos e texto impreciso de retomada. Casos e refinamentos ainda abertos:
[relatório exploratório](exploratory-testing.md).

Typecheck e lint aprovados; 192 testes da API e 390 da web passaram, com os
81 testes inalterados do motor reaproveitados do cache. A suíte integrada
ampliada aprovou 262 casos distintos em 13/11 após limitar a concorrência do
runner de precificação a dois workers. Na retomada de 14/11, a rodada
`0b2f3b328ab3ddaa` aprovou novamente 59 E2E comerciais e os cinco cenários
de navegador, incluindo as regressões exploratórias com aplicação compilada.
Backup/restauração conferiu 18 migrations, quatro versões, 59 orçamentos e
24 pedidos; bases e contêiner removidos. Nenhum banco normal foi alterado.

O check global de formatação sinalizou somente o arquivo da skill instalada
pelo usuário, preservado como recebido. Permanecem refinamentos de UX e
acessibilidade documentados; o aceite na máquina final continua necessário.

### Preparação inicial

- Início da aplicação compilada com `pnpm start`, interface em porta fixa e
  API em loopback por padrão (`API_HOST` permite configuração explícita).
- `db:deploy` para aplicar migrations versionadas, sem gerar migrations novas.
- Node 24 indicado em `.nvmrc`; instruções para pnpm, Docker e Windows/WSL2.
- Cache de build considera `.env` e `VITE_API_URL`, evitando reutilizar uma
  interface compilada para outro endereço de API.
- Identificadores únicos nos formulários de competência simultâneos do guia.
- Percentuais calculados apresentados com até duas casas e indicação `≈`
  quando aproximados, sem modificar entradas, cálculos ou snapshots. A revisão
  visual encontrou margens com centenas de casas; o histórico também passou
  a preservar corretamente o sinal negativo na apresentação dessas margens.
- Fixtures de quatro suítes de precificação atualizadas para criar sessões com
  organização ativa; limpeza de dez suítes remove primeiro as sessões do
  usuário fictício, respeitando a FK de associação ativa. Nenhuma limpeza
  global, alteração de permissões ou relaxamento de constraints foi introduzido.
- Documentação real substitui os READMEs de template; manual segue custos,
  insumos, produtos, clientes, orçamentos, pedidos, financeiro e estoque.
- Piloto inclui cadastro guiado real e verificação do bootstrap compilado.
  A opção `PILOT_TEST_FULL_API=YES` amplia a conferência para os demais E2E,
  mantendo o banco normal fora da execução.

## Evidências desta rodada

Ambiente: Node 24.22.1, pnpm 11.13.1, PostgreSQL 18 em contêiner descartável.
Nenhuma migration nova foi criada; nenhum banco normal foi alterado.

- `typecheck`, `lint`, `test` e `build` executados sem cache do Turborepo:
  184 testes da API, 388 da web e 81 do motor (653 no total na conferência
  final de 13/11). Instalação com lockfile congelado e schema Prisma validados;
  formatação e `git diff --check` conferidos.
- Suíte ampliada: 127 execuções de testes de precificação/comercial e 194 de
  autenticação, financeiro, estoque e comercial. São 262 casos E2E distintos
  em 20 arquivos; os 59 comerciais são exercitados nas duas rodadas.
- Quatro cenários Playwright aprovados: precificação/orçamento/pedido,
  segurança dos convites, aceite/seleção de organização e cadastro guiado.
  O guia salvou despesas fixas/variáveis, insumo, configuração, composição,
  versão, adoção e cliente; a consulta posterior confirmou R$ 15,39 para o
  caso fictício de custo R$ 10, fixos 10% e margem 25%.
- O bootstrap real da API compilada respondeu ao health com banco conectado.
  O teste do guia usa build web e `vite preview`, com porta estrita.
- Rodada ampliada `1db9ec99c93a59d7`: migrations aplicadas em base vazia;
  backup restaurado em `meinager_restore_1db9ec99c93a59d7`, conferindo 18
  migrations, quatro versões, 59 orçamentos, 24 pedidos e consulta pela API.
  As bases de prova, origem e restauração e o contêiner foram removidos.
- Após o refinamento dos percentuais, a rodada `b01233a310bdb040` aprovou
  novamente os 59 E2E comerciais e os quatro cenários de navegador, incluindo
  o guia com build web em modo de produção. A restauração repetiu a conferência
  de 18 migrations, quatro versões, 59 orçamentos e 24 pedidos; origem,
  restauração e contêiner foram removidos. A captura de precificação foi
  inspecionada e confirmou percentuais legíveis, como `≈ 18,33%`.
- As primeiras tentativas identificaram bibliotecas ausentes do Chromium e
  fixtures/limpezas antigas incompatíveis com sessões organizacionais. As
  fixtures foram corrigidas; o navegador passou com bibliotecas temporárias
  em `/tmp`, sem exigir alteração global do sistema. O procedimento padrão de
  instalação das dependências de teste está no README.

A consulta de status pelo MCP do Prisma falhou neste ambiente, sem diagnóstico
detalhado. A aplicação das 18 migrations e a restauração foram comprovadas nos
bancos descartáveis. O status do banco normal não é certificado por esta rodada;
na máquina final, execute `pnpm db:status` conforme o guia antes do uso.

## Limitações e refinamentos

| Item                                                               | Tratamento para uso local                                                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Custos do Financeiro não alimentam a precificação automaticamente  | Manual orienta apuração e configuração explícita; evitar dupla contagem.                       |
| Insumos compartilham Produtos; não há conversão de unidades        | Padronizar unidade de consumo e custo antes do cadastro.                                       |
| Preço sugerido não é adotado automaticamente                       | Salvar composição, confirmar simulação, salvar versão e adotar.                                |
| Atualização de insumo não atualiza preços ou documentos anteriores | Revisar os produtos afetados e gerar novas versões quando necessário.                          |
| Pedido não movimenta estoque nem gera recebimento automaticamente  | Registrar movimentações e baixas separadamente.                                                |
| Despesas sem recorrência automática                                | Abrir competência e registrar o mês seguinte.                                                  |
| Enviar orçamento apenas muda status                                | Comunicação com cliente é externa; geração de documento compartilhável é refinamento sugerido. |
| Convites sem comprovação de posse de e-mail                        | Limitar ao piloto local com pessoas conhecidas; não liberar publicamente.                      |
| Sem instalador e serviço de início automático                      | Instalação assistida e início diário pelo terminal.                                            |
| Backup manual                                                      | Definir responsável, frequência e cópia externa; validar restauração.                          |

Não há recuperação de senha por e-mail nesta versão. Oriente a guarda das
credenciais e defina suporte pelo responsável antes do uso.

Prioridades de refinamento: facilitar inicialização para usuário não técnico,
documento compartilhável do orçamento, despesas recorrentes, conversão de
unidades e revisão assistida dos produtos afetados por custos alterados.
Automações de estoque/financeiro precisam de regras de negócio e auditoria
próprias, em uma entrega separada.

## Conferência para entrega

Entregar a árvore completa revisada, incluindo os arquivos novos; não copiar
credenciais, banco de desenvolvimento ou backups reais. Em uma máquina nova,
seguir o [guia de instalação](installation.md), criar conta própria e completar
o percurso do [manual de uso](../manual-de-uso.md). Registrar reinicialização,
persistência e recuperação antes de iniciar operação com dados reais.
