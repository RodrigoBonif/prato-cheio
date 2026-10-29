# ADR 0002 — Ciclo de vida da doação como máquina de estados com transições atômicas

- **Data:** 28/10/2026
- **Status:** aceito (implementado nas histórias H2 e H3 desta entrega)

## Contexto

No MVP uma doação só tinha dois estados: `disponivel` e `reservada`. As novas histórias
pedem mais dois desfechos:

- **H2** — o restaurante **cancela** uma doação que ainda ninguém reservou;
- **H3** — a ONG **confirma a retirada**, fechando o ciclo.

Isso cria disputas reais sobre a mesma linha: o restaurante pode clicar em "Cancelar" no
mesmo segundo em que uma ONG clica em "Reservar". O sistema precisa garantir que **só uma
das duas operações vença** e que a outra receba uma resposta clara, sem deixar a doação em
estado incoerente (por exemplo, cancelada mas com `ong_id` preenchido).

Também precisávamos decidir o que fazer com a doação cancelada: apagar ou manter.

## Alternativas consideradas

1. **Ler, conferir no JavaScript e depois gravar** (`SELECT` → `if (status === ...)` → `UPDATE`)
   - Prós: lógica toda visível em um lugar.
   - Contras: **condição de corrida** — entre o `SELECT` e o `UPDATE` outra requisição pode
     mudar o status; as duas "vencem".
2. **Transação com trava explícita** (`BEGIN` + `SELECT ... FOR UPDATE` + `UPDATE` + `COMMIT`)
   - Prós: correto, padrão em PostgreSQL.
   - Contras: o SQLite não tem `FOR UPDATE`; o `db.js` atual não expõe transações; mais código
     e mais chance de esquecer um `ROLLBACK`.
3. **`UPDATE` condicional** — a regra de transição vai no `WHERE`
   (`... WHERE id = ? AND status = 'disponivel' AND restaurante_id = ?`) com `RETURNING *`;
   se nenhuma linha voltar, a transição não era permitida.
   - Prós: atômico no próprio banco (uma instrução); funciona igual em SQLite e PostgreSQL;
     é o mesmo padrão que o MVP já usava para a reserva.
   - Contras: quando o `UPDATE` falha não sabemos *por quê* sem uma leitura extra.
4. **Excluir a doação ao cancelar (`DELETE`)**
   - Prós: simples.
   - Contras: some o histórico do restaurante; uma ONG com a tela aberta recebe 404 em vez de
     uma mensagem de que foi cancelada; perde dado para métricas de impacto.

## Decisão

**Modelar a doação como máquina de estados explícita e fazer cada transição com um único
`UPDATE` condicional (alternativa 3). Cancelamento é um estado (`cancelada`), não exclusão.**

```
disponivel ──reservar (ONG)──▶ reservada ──confirmar retirada (ONG que reservou)──▶ retirada
     │
     └──cancelar (restaurante dono)──▶ cancelada
```

| Transição | Quem | Guarda no `WHERE` | Coluna de data |
|---|---|---|---|
| reservar | ONG | `status = 'disponivel'` | `reservada_em` |
| cancelar | restaurante dono | `status = 'disponivel' AND restaurante_id = ?` | `cancelada_em` |
| confirmar retirada | ONG que reservou | `status = 'reservada' AND ong_id = ?` | `retirada_em` |

A leitura prévia (`buscarPorId`) é usada **só para escolher a mensagem de erro** — 404 se não
existe, 403 se a doação é de outra pessoa — e nunca para autorizar a gravação. Quem decide se a
transição acontece é o `UPDATE`. Se ele não alterar nada, a resposta é **409 Conflict**.

Código: `src/repositorio.js` (`reservar`, `cancelar`, `confirmarRetirada`) e
`src/doacoes.js` (regras e mensagens).

## Consequências

- **Positivas:**
  - Corrida entre cancelar e reservar resolvida sem trava manual: só um `UPDATE` encontra
    `status = 'disponivel'`. Testado em `tests/cancelamento.test.js` ("uma ONG não consegue
    reservar a doação cancelada", "recusa cancelar doação já reservada").
  - Padrão único para todas as transições — a próxima (ex.: ONG desistir da reserva) segue o
    mesmo molde.
  - Funciona igual nos dois bancos, o que reduz o risco do ADR 0001.
  - O restaurante mantém o histórico completo (cancelada e retirada aparecem no painel).
- **Negativas / o que abrimos mão:**
  - Uma leitura extra por operação para montar a mensagem de erro.
  - As transições permitidas estão no SQL, não em uma tabela central de regras; quem ler o
    código precisa olhar o `WHERE`. Mitigado pela tabela acima e pelos comentários no repositório.
  - O status ainda é `TEXT` sem `CHECK` no SQLite (não dá para adicionar via `ALTER TABLE`);
    o `CHECK` entra na migração para PostgreSQL.
- **Riscos e o que fazer se der errado:** se surgir uma transição que precise alterar duas
  tabelas ao mesmo tempo (ex.: registrar um evento de auditoria), o `UPDATE` condicional sozinho
  não basta — aí adotamos transação (alternativa 2), o que fica viável depois do PostgreSQL.

## Rastreabilidade

- Regra de negócio do caso: "uma doação reservada não fica disponível para outra ONG".
- RNF **Consistência sob concorrência** e RNF **Segurança / controle de acesso** (`docs/projeto.md`).
- Histórias H2 e H3.
