# Teste exploratório — 13–14/11/2026

## Método e escopo

Exploração orientada por hipóteses em Chromium com API e PostgreSQL reais,
descartáveis. Os experimentos foram executados por Playwright e adaptados aos
achados; não foi uma sessão manual com usuário final. A revisão de interface
seguiu a skill local `web-design-guidelines` e as
[diretrizes consultadas](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

Percursos: cadastro inicial, custos fixos/variáveis, insumos, composição,
simulação, versão, adoção, cliente, orçamento e pedido. Além da regressão
existente, a exploração provocou campos inválidos, resposta HTTP 503 ao salvar,
navegação com alterações pendentes e exibição do guia a 390 px.

## Achados corrigidos

| Achado                                                 | Reprodução e impacto                                                                                                                                                                | Correção                                                                                                                                                                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E01 — perda de rascunho de preço, prioridade alta      | Alterar margem no guia, abrir “Cadastrar perfil de venda” e clicar “Criar orçamento”. A navegação ocorria sem confirmação; console: `A router only supports one blocker at a time`. | Configuração, perfil e composição compartilham um guard por página. Apenas um diálogo aparece, com opções para continuar ou descartar. Formulários individuais mantêm a proteção.                                     |
| E02 — contatos inválidos aceitos, prioridade média     | Informar `abc` em CPF/CNPJ e telefone. O formulário enviava; a API normalizava os campos para ausência. Na edição, isso podia apagar um contato válido.                             | Frontend e DTOs de criação/edição rejeitam texto inválido. Campos vazios continuam opcionais; números com pontuação usual são normalizados. Erros do cliente foram associados aos campos para tecnologias assistivas. |
| E03 — promessa de retomada imprecisa, prioridade baixa | O guia afirmava permitir continuar de onde parou, mas seus campos não salvos e o produto em edição são estado transitório.                                                          | Texto explica o salvamento por formulário, a consulta aos cadastros persistidos e a perda de campos não salvos ao recarregar.                                                                                         |

Implementação: [proteção compartilhada](../../apps/web/src/features/pricing/pricing-draft-navigation.tsx),
[registro dos rascunhos](../../apps/web/src/features/pricing/use-pricing-draft-blocker.ts),
[formulário de cliente](../../apps/web/src/features/clients/client-form.tsx),
[criação de cliente](../../apps/api/src/clients/dto/create-client.dto.ts),
[edição de cliente](../../apps/api/src/clients/dto/update-client.dto.ts) e
[guia](../../apps/web/src/pages/guided-setup-page.tsx).

## Observações positivas

- Falha 503 ao cadastrar insumo exibiu erro e preservou os valores. Após
  restabelecer o endpoint, a repetição salvou o insumo.
- Enviar cliente sem nome levou o foco ao campo obrigatório.
- Guia inicial a 390 px apresentou largura de conteúdo igual à viewport,
  sem IDs duplicados. A captura foi inspecionada; isso não certifica todas
  as combinações de conteúdo, zoom ou dispositivos.
- O fluxo integrado existente percorreu precificação, orçamento e pedido;
  o cadastro guiado confirmou preço de R$ 15,39 no exemplo documentado.

## Refinamentos ainda abertos

- O guia é extenso em telas pequenas. Evoluir para etapas recolhíveis e
  indicadores de conclusão facilitaria o uso, sem mudar as regras de cálculo.
- [Layout principal](../../apps/web/src/components/layout/app-layout.tsx):
  falta um atalho de teclado “Pular para o conteúdo”.
- [Custos guiados](../../apps/web/src/features/finance/guided-cost-entry.tsx):
  erros de validação são gerais; associar cada erro ao campo e mover o foco
  para o primeiro campo inválido melhoraria a acessibilidade.
- Formulários simples de custos, insumos e clientes não possuem recuperação
  automática de rascunho nem confirmação geral de saída. Salvar cada cadastro
  antes de navegar, conforme o manual. O ajuste E01 protege os formulários
  de precificação, sem prometer autosave.
- Leitor de tela real, contraste integral, zoom do navegador, Safari/Firefox,
  uso prolongado e máquina final do usuário não foram homologados nesta rodada.

## Evidências

A primeira rodada `9b01405a270b8de1` aprovou 59 E2E comerciais e cinco cenários
de navegador, incluindo o experimento que reproduziu E01/E02. Esses experimentos
observacionais passaram tecnicamente mesmo contendo os bugs; após a correção,
as expectativas foram convertidas em asserções de regressão.

O backup restaurado preservou 18 migrations, quatro versões, 59 orçamentos e
24 pedidos, com consulta pela API. Bases e contêiner foram removidos. Uma
tentativa posterior da suíte ampliada teve dois timeouts de `beforeAll` de
10 segundos; a repetição teve timeout de preparação e de um teste de adoção.
Ambas limparam suas bases. O runner iniciava nove suítes em paralelo sem limite
explícito; sua concorrência foi limitada a dois workers, sem aumentar timeouts.
O resultado da repetição final deve ser lido no relatório de liberação.

**Encerramento em 14/11:** rodada `0b2f3b328ab3ddaa` concluída com 59 E2E
comerciais e cinco cenários Playwright aprovados. A regressão confirmou rejeição
HTTP 400 para contatos inválidos, mensagens associadas aos campos, preservação
após erro 503 e confirmação única de saída com configuração e perfil abertos.
API e web compiladas; guia servido por `vite preview`. Backup restaurado com
18 migrations, quatro versões, 59 orçamentos e 24 pedidos, conferido pela API.
As bases de origem/restauração e o contêiner foram removidos pelo runner.

Antes da interrupção da sessão de 13/11, a rodada `02e857f6591b1600`
confirmou 127 testes de precificação/comercial e 194 dos demais módulos
(262 casos distintos, com sobreposição comercial), além dos três primeiros
cenários de navegador. O encerramento dessa execução não foi observado;
seus logs temporários não estavam disponíveis na retomada de 14/11. Por isso,
o piloto de navegador e a restauração foram repetidos, sem presumir sucesso
da etapa final anterior. A consulta ao Docker na retomada não encontrou
contêiner antigo do piloto.

Validação de código após as correções: typecheck e lint sem erros ou avisos;
192 testes da API e 390 da web passaram. O pipeline também reaproveitou do
cache os 81 testes do motor, que não foi alterado. A proteção conjunta tem
regressão para dois rascunhos simultâneos: salvar um não libera a saída
enquanto o outro permanece alterado.

Na retomada, `prettier --check .` apontou somente a skill instalada pelo
usuário em `.agents/skills/web-design-guidelines/SKILL.md`. O arquivo externo
de instruções foi preservado; esse aviso de formatação não é uma falha da
aplicação.

Regressões adicionadas: [navegador](../../apps/web/test/pilot/exploratory-setup.spec.ts),
[proteção conjunta](../../apps/web/src/features/pricing/pricing-draft-navigation.spec.tsx),
[cliente web](../../apps/web/src/features/clients/client-form.spec.tsx) e
[normalização da API](../../apps/api/src/clients/dto/client-contact-validation.spec.ts).
