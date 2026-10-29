# Diagramas — Prato Cheio (atividade de diagramas da N2)

**Onde está cada coisa (para o professor):**

| O que a atividade pede | Onde está |
|---|---|
| Diagramas escolhidos e justificativa | [Seção 1](#1-diagramas-escolhidos) deste arquivo |
| Ferramenta de IA e prompt usado | [Seção 2](#2-ferramenta-de-ia-e-prompt) |
| Versões iniciais geradas pela IA (sem correção) | [`ia-original/estados.md`](ia-original/estados.md) · [`ia-original/sequencia.md`](ia-original/sequencia.md) |
| Problemas, justificativas e correções | [Seção 3](#3-análise-crítica) |
| Versões finais | [`final/estados.md`](final/estados.md) · [`final/sequencia.md`](final/sequencia.md) |
| Imagens renderizadas (só para visualizar) | [`img/`](img/) |
| Reflexão final | [Seção 5](#5-reflexão-final) |

Formato: **Mermaid** dentro de Markdown. É texto, então fica versionado no Git, aparece no
diff dos PRs e o GitHub renderiza direto na página. As imagens em `img/` foram geradas a partir
desses arquivos com o `mermaid-cli`; o arquivo editável é sempre o `.md`.

## 1. Diagramas escolhidos

| Diagrama | Pergunta que responde | Por que precisamos dele |
|---|---|---|
| **Estados (UML)** | Quais estados uma doação pode assumir, quem provoca cada mudança e o que é proibido? | A Entrega 2 criou dois estados novos (`cancelada`, `retirada`). As regras de negócio do Prato Cheio são quase todas regras de transição: "reservada não volta para o feed", "só o dono cancela". |
| **Sequência (UML)** | Como as partes do sistema colaboram numa operação, e o que acontece quando duas pessoas agem ao mesmo tempo? | A decisão mais delicada do projeto (ADR 0002) está na **ordem** das chamadas: a leitura escolhe a mensagem, mas é o `UPDATE` condicional que decide. Só um diagrama de sequência mostra isso. |

Os dois respondem perguntas diferentes. O de estados olha para o **dado** (a doação) ao longo
do tempo. O de sequência olha para o **código**: quais módulos são chamados, em que ordem, e onde
cada erro nasce.

## 2. Ferramenta de IA e prompt

**Ferramenta:** Claude (Anthropic).

### Prompt usado

Passamos para a IA só a descrição do caso, sem o código, para ver o que ela supõe sozinha:

> Estou modelando o sistema Prato Cheio, que conecta restaurantes com comida excedente a ONGs.
> Histórias: (1) o restaurante publica uma doação com tipo, quantidade, validade e janela de
> retirada; (2) a ONG vê as doações disponíveis e reserva uma, que sai do feed das outras ONGs;
> (3) o restaurante pode cancelar uma doação que publicou; (4) a ONG confirma que retirou a
> doação; (5) doações vencidas não devem ser oferecidas. Regra: uma doação reservada não fica
> disponível para outra ONG. Gere em Mermaid: (a) um diagrama de estados UML da doação e (b) um
> diagrama de sequência UML da operação "restaurante cancela uma doação", com frontend, API e
> banco.

As respostas foram guardadas **sem nenhuma alteração** em [`ia-original/`](ia-original/).

## 3. Análise crítica

Confrontamos as versões da IA com as histórias, as regras de negócio, os ADRs e o código
(`src/doacoes.js`, `src/repositorio.js`, `src/app.js`, `src/auth.js`, `src/db.js`).
Encontramos cinco problemas.

### Problema 1 — Estados: "Expirada" representada como um estado (elemento desnecessário)

- **Problema:** a IA criou o estado `Expirada`, com a transição automática "Validade vence"
  saindo de Disponível e de Reservada.
- **Justificativa:** no Prato Cheio, nenhum processo muda o status quando a validade passa. A
  doação continua `disponivel` no banco e é a consulta do feed que a esconde
  (`WHERE validade >= ?` em `listarDisponiveis`). Desenhar "Expirada" como estado faria alguém
  procurar um job ou um valor de status que não existe, e a coluna `status` nunca recebe esse valor.
- **Correção:** removemos o estado. Acrescentamos uma **nota** em `disponivel` explicando que
  "vencida" é uma condição de exibição, não um estado. A validade aparece na **guarda** da
  publicação (`validade >= hoje`), que é onde a regra é de fato aplicada.

### Problema 2 — Estados: transições que a regra de negócio proíbe (regra ignorada)

- **Problema:** a IA desenhou `Reservada → Cancelada` ("restaurante cancela") e
  `Reservada → Disponível` ("ONG desiste da reserva").
- **Justificativa:** pela história H2, o restaurante só cancela doação **ainda não reservada**.
  Se cancelasse depois, a ONG poderia se deslocar até o restaurante por uma comida que não existe
  mais. No código, o `UPDATE` de cancelamento exige `status = 'disponivel'` e devolve **409**
  quando a doação está reservada (teste "recusa cancelar doação já reservada"). A desistência da
  ONG não foi implementada. Desenhar essas setas documentaria um comportamento falso.
- **Correção:** removemos as duas transições. Acrescentamos uma nota em `reservada` ("não pode
  ser cancelada pelo restaurante — 409"). A desistência da ONG ficou registrada como próximo passo
  na retrospectiva, não no diagrama.

### Problema 3 — Estados: transições sem guarda e nomes diferentes da implementação (notação e coerência)

- **Problema:** as transições só tinham o nome do evento ("ONG reserva"), sem dizer **quem pode**.
  Os nomes dos estados também não batiam com o banco (`Coletada` em vez de `retirada`,
  maiúsculas e sem os valores reais).
- **Justificativa:** as regras mais importantes do caso são de autorização: só a ONG **que
  reservou** confirma a retirada, e só o restaurante **dono** cancela. A notação UML tem um lugar
  para isso, a guarda `[condição]`. Com o nome errado, quem fosse comparar o diagrama com o
  `status` gravado se confundiria.
- **Correção:** usamos os valores exatos de `doacoes.status` e escrevemos cada transição no
  formato UML `evento [guarda] / efeito`, por exemplo
  `confirmar retirada [ONG que reservou] / retirada_em`. Também acrescentamos uma tabela
  ligando cada evento à rota e aos códigos de erro.

### Problema 4 — Sequência: "ler e depois gravar", o contrário da decisão do projeto (inconsistência com a implementação)

- **Problema:** a IA fez `SELECT status` → testa no código da API → `DELETE`.
- **Justificativa:** duas falhas. (a) Entre o `SELECT` e a gravação, uma ONG pode reservar a
  doação, e o cancelamento passaria mesmo assim. É exatamente a **condição de corrida** que o
  ADR 0002 rejeita. (b) O `DELETE` apaga o histórico do restaurante, e a ONG com a tela aberta
  receberia 404 em vez de uma mensagem clara. No código, o cancelamento é um
  `UPDATE ... SET status = 'cancelada' ... WHERE status = 'disponivel' AND restaurante_id = ?`, e
  a leitura anterior serve só para escolher a mensagem de erro.
- **Correção:** a versão final mostra a leitura (`buscarPorId`) apenas escolhendo entre 404 e 403.
  Depois vem o `UPDATE` condicional com `RETURNING *`, e o `alt` decide pelo número de linhas
  alteradas (1 → 200; 0 → 409). Uma nota marca o intervalo em que uma ONG pode reservar a
  mesma doação.

### Problema 5 — Sequência: participantes genéricos e fluxos de erro ausentes (elementos ausentes)

- **Problema:** a IA usou só "Frontend", "API" e "Banco". Os únicos caminhos eram "disponível"
  e "reservada", com erro 400. Também usou `DELETE /api/doacoes/{id}`, rota que não existe.
- **Justificativa:** com a API como uma caixa só, somem duas camadas de autorização reais:
  `auth.js` (401 sem login, 403 perfil errado) e `doacoes.js` (403 doação de outro restaurante).
  Some também o 404 de doação inexistente. O 400 está errado: conflito de estado é **409**, e o
  front e os testes dependem dessa diferença. A rota real é `POST /api/doacoes/:id/cancelar`.
- **Correção:** os participantes viraram os módulos reais do repositório, na ordem em que o
  Express os chama (rota → middleware → regra → repositório → `db.js`). Acrescentamos os `alt`
  para 401, 403 de perfil, 404, 403 de dono e 409, com as mensagens reais. Ganho extra: fica
  visível que só o `db.js` fala com o SQLite, o que sustenta o ADR 0001 (migração para
  PostgreSQL).

### Resumo

| # | Diagrama | Tipo de problema | Correção em uma linha |
|---|---|---|---|
| 1 | Estados | Elemento desnecessário | `Expirada` sai e vira nota; validade vira guarda da publicação |
| 2 | Estados | Regra de negócio ignorada | Removidas `reservada → cancelada` e `reservada → disponivel` |
| 3 | Estados | Notação / coerência | Guardas `[quem pode]` e nomes iguais aos de `doacoes.status` |
| 4 | Sequência | Inconsistente com o código | `SELECT` + `DELETE` trocados por `UPDATE` condicional com 409 |
| 5 | Sequência | Elementos e erros ausentes | Módulos reais, rota real e os erros 401, 403, 404, 409 |

## 4. Versões finais

- [`final/estados.md`](final/estados.md) — 4 estados reais, 4 transições com guarda e efeito,
  2 notas, tabela evento → rota → erros.
- [`final/sequencia.md`](final/sequencia.md) — cancelar doação passando pelos 6 módulos, com
  todos os caminhos de erro e o ponto de concorrência.

Os dois foram confrontados com:
- histórias H1, H2 e H3 e seus critérios de aceite (`docs/projeto.md`);
- regra "reservada não fica disponível para outra ONG";
- ADR 0001 e ADR 0002 (`docs/adr/`);
- schema da tabela `doacoes` em `src/db.js` (colunas `status`, `ong_id`, `reservada_em`,
  `cancelada_em`, `retirada_em`);
- testes em `tests/` (cada transição e cada recusa desenhada tem um teste correspondente).

## 5. Reflexão final

**Qual dos dois diagramas foi mais útil para compreender ou questionar uma decisão do projeto? Por quê?**

O **diagrama de sequência**. O de estados mostrou *o que* é permitido, mas foi o de sequência
que expôs *como* a regra é garantida. Ao ver a versão da IA fazendo `SELECT` e depois `DELETE`,
percebemos que essa ordem parece correta e funciona nos testes do caminho feliz, mas falha
quando uma ONG reserva no meio do caminho.

Isso nos fez questionar e confirmar a decisão do ADR 0002: a leitura só escolhe a mensagem, e
quem decide é o `UPDATE` condicional. O diagrama também mostrou que só o `db.js` acessa o
banco, o que reforçou a decisão de concentrar a migração para PostgreSQL nele (ADR 0001).

A lição sobre a IA foi que ela produziu diagramas **plausíveis**: notação certa, nomes razoáveis.
Mas ela modelou o sistema "típico", não o nosso. Os erros só apareceram quando comparamos cada
seta com uma linha de código e com um teste.
