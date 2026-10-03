# Escopo e roadmap do Meinager

## 1. Objetivo do produto

O Meinager é uma plataforma web de gestão para microempresas e
microempreendedores individuais.

O sistema deve integrar:

- clientes;
- produtos e serviços;
- estoque;
- financeiro;
- orçamentos;
- pedidos;
- fluxos operacionais;
- precificação.

O produto deve atender organizações de diferentes segmentos sem incorporar
valores ou regras específicas de uma única empresa.

## 2. Estado atual

Estão implementados:

- autenticação e sessões;
- organizações e membros;
- autorização por papel;
- clientes;
- produtos e serviços;
- movimentações de estoque;
- categorias financeiras;
- contas financeiras;
- lançamentos;
- baixas;
- períodos financeiros;
- resumo financeiro;
- orçamentos;
- pedidos;
- fluxos configuráveis de pedidos;
- auditoria para ações relevantes.

O próximo domínio prioritário é a precificação inteligente de produtos e
serviços.

## 3. Objetivo da entrega de precificação

Ao final da primeira entrega, um usuário autorizado deverá conseguir:

1. configurar os parâmetros de precificação da organização;
2. criar perfis de taxas e deduções;
3. montar a composição de custos de um produto ou serviço;
4. calcular mão de obra e frete;
5. simular preço mínimo e sugerido;
6. compreender a decomposição do preço;
7. informar ou adotar um preço comercial;
8. visualizar lucro e margem efetiva;
9. consultar versões anteriores;
10. preservar a origem do preço em orçamentos e pedidos.

## 4. Escopo da primeira entrega

### Incluído

- motor decimal `margin-divisor-v1`;
- custos diretos e componentes;
- mão de obra por tempo;
- frete manual ou rateado;
- percentual de custos fixos;
- perfis de deduções;
- margem desejada;
- preço mínimo;
- preço sugerido;
- preço adotado;
- análise de lucro e margem;
- desconto máximo;
- versões imutáveis;
- snapshots;
- auditoria;
- permissões;
- interface integrada aos produtos;
- testes unitários, de integração e de interface;
- compatibilidade com produtos existentes.

### Não incluído

- cálculo automático baseado em lançamentos financeiros;
- comparação entre custo estimado e realizado;
- atualização automática dos parâmetros;
- sugestão baseada em inteligência artificial;
- previsão de demanda;
- sazonalidade;
- múltiplas moedas operacionais;
- calendário;
- notificações;
- metas;
- ponto de equilíbrio no dashboard;
- relatórios avançados de rentabilidade.

Esses itens são evoluções futuras e não devem bloquear a primeira entrega.

## 5. Marcos de implementação

### Marco 0 — Auditoria técnica

Objetivo: compreender os padrões existentes antes de alterar código.

Atividades:

- inspecionar schema Prisma;
- inspecionar módulos de produtos, estoque, financeiro, orçamentos e pedidos;
- identificar o tipo decimal já utilizado;
- identificar padrões de DTO, validação, autorização e auditoria;
- identificar contratos da API e schemas Zod do frontend;
- confirmar como preços são serializados;
- registrar descobertas no plano executável.

Resultado esperado:

- plano atualizado com caminhos e decisões técnicas;
- nenhuma alteração funcional ainda.

### Marco 1 — Motor matemático puro

Objetivo: implementar o cálculo sem banco, HTTP ou interface.

Atividades:

- criar tipos de entrada e saída;
- implementar valores decimais;
- implementar validações;
- implementar componentes;
- implementar mão de obra;
- implementar frete;
- implementar custos fixos;
- implementar deduções;
- calcular mínimo, sugerido e adotado;
- gerar decomposição;
- gerar códigos de erro;
- cobrir `EX-001` até `EX-012`.

Resultado esperado:

- motor determinístico;
- testes unitários aprovados;
- nenhuma persistência necessária.

### Marco 2 — Persistência

Objetivo: persistir configurações, composições e versões.

Atividades:

- criar modelos Prisma;
- definir índices e restrições;
- criar migration;
- preservar produtos existentes;
- implementar numeração concorrente de versões;
- garantir imutabilidade;
- relacionar preço atual à versão adotada;
- validar migration em banco com dados.

Resultado esperado:

- schema válido;
- migration aplicável;
- dados existentes preservados.

### Marco 3 — API

Objetivo: disponibilizar os casos de uso do domínio.

Atividades:

- configurar parâmetros;
- gerenciar perfis de deduções;
- consultar e editar composição;
- simular sem salvar;
- salvar versão;
- consultar histórico;
- adotar preço;
- confirmar preço abaixo do mínimo;
- validar organização e permissões;
- criar auditoria;
- adicionar testes e2e.

Resultado esperado:

- API autoritativa e isolada por organização;
- cobertura de autenticação, autorização e concorrência.

### Marco 4 — Interface web

Objetivo: integrar a precificação ao cadastro do produto.

Atividades:

- consultar configuração;
- editar composição;
- apresentar custos por categoria;
- recalcular prévia localmente;
- exibir preço mínimo e sugerido;
- exibir decomposição;
- informar preço manual;
- adotar preço;
- alertar preço abaixo do mínimo;
- exibir histórico;
- comunicar carregamento, erro e sucesso;
- cobrir acessibilidade e permissões;
- adicionar testes de interface.

Resultado esperado:

- fluxo completo utilizável pelo produto;
- produtos antigos continuam funcionais.

### Marco 5 — Orçamentos e pedidos

Objetivo: preservar a origem do preço nos documentos comerciais.

Atividades:

- relacionar item de orçamento à versão quando aplicável;
- preservar preço e dados comerciais;
- copiar referência durante a conversão em pedido;
- impedir recálculo de documentos existentes;
- garantir que custos internos não sejam expostos ao cliente;
- adicionar testes de não regressão.

Resultado esperado:

- rastreabilidade sem alteração retroativa.

### Marco 6 — Validação final

Objetivo: provar que a entrega está completa e não introduziu regressões.

Atividades:

- executar validação do Prisma;
- executar migrations;
- executar typecheck;
- executar lint;
- executar testes unitários;
- executar testes e2e;
- executar testes web;
- executar builds;
- verificar formatação;
- verificar migrations aplicadas;
- atualizar a matriz de rastreabilidade;
- revisar documentação;
- executar teste visual.

Resultado esperado:

- todos os critérios da primeira entrega validados;
- árvore de trabalho limpa após o commit.

## 6. Roadmap posterior

### Fase 2 — Integração financeira

- custos fixos derivados do financeiro;
- faturamento médio dos períodos concluídos;
- atualização assistida;
- indicação de dados desatualizados;
- comparação de parâmetros manuais e realizados.

### Fase 3 — Rentabilidade realizada

- custos consumidos na execução;
- custo estimado versus realizado;
- lucro estimado versus realizado;
- rentabilidade por produto;
- rentabilidade por pedido;
- rentabilidade por cliente.

### Fase 4 — Gestão estratégica

- ponto de equilíbrio;
- metas de faturamento;
- metas de lucro;
- margem de contribuição;
- acompanhamento mensal;
- alertas gerenciais.

### Fase 5 — Automação

- recorrência financeira;
- calendário;
- notificações;
- sugestões de revisão de preços;
- alertas de margem;
- apoio inteligente à precificação.

## 7. Restrições

A implementação deve:

- preservar isolamento por organização;
- preservar permissões existentes;
- preservar produtos sem precificação;
- preservar orçamentos e pedidos existentes;
- não criar movimentação de estoque durante a precificação;
- não criar lançamentos financeiros durante uma simulação;
- não recalcular documentos históricos;
- não armazenar dinheiro com ponto flutuante binário;
- não confiar nos resultados calculados pelo frontend;
- não aplicar valores de exemplo como padrão de negócio.

## 8. Dependências entre marcos

A ordem padrão é:

```text
Auditoria técnica
    -> Motor matemático
    -> Persistência
    -> API
    -> Interface
    -> Orçamentos e pedidos
    -> Validação final
```

Um marco poderá começar parcialmente antes do anterior terminar apenas quando
não depender de decisões ainda abertas.

Persistência não deve ser implementada antes de o motor e seus contratos
estarem definidos.

A interface não deve definir fórmulas próprias divergentes do motor oficial.

## 9. Regra de conclusão

Um marco não está concluído apenas porque seus arquivos foram criados.

Para ser considerado concluído, deve:

1. produzir o comportamento observável esperado;
2. possuir testes relevantes;
3. preservar funcionalidades existentes;
4. atualizar o plano executável;
5. atualizar a matriz de rastreabilidade;
6. não deixar erros de typecheck, lint, teste ou build relacionados à mudança.

## 10. Fontes oficiais

A implementação deve consultar:

- `docs/domains/pricing/README.md`;
- `docs/domains/pricing/business-rules.md`;
- `docs/domains/pricing/calculation-specification.md`;
- `docs/domains/pricing/examples.md`;
- `docs/domains/pricing/acceptance-criteria.md`;
- `docs/architecture/decisions/`;
- `docs/product/requirements-traceability.md`.

O documento original em `docs/product/sources/` é material histórico e não
substitui as fontes oficiais.
