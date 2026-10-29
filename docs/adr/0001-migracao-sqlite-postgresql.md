# ADR 0001 — Migrar o banco de SQLite para PostgreSQL

- **Data:** 28/10/2026
- **Status:** aceito — preparação feita na Unidade 2, execução da troca na Unidade 3

## Contexto

O Prato Cheio nasceu com SQLite (`node:sqlite`, embutido no Node) porque isso deixou o
walking skeleton rodando sem instalar nada. Com as histórias desta entrega o sistema
passou a ter **mais escritas concorrentes sobre a mesma linha** (reservar, cancelar e
confirmar retirada da mesma doação) e o caminho para produção começou a aparecer.
Os limites do SQLite que pesam aqui:

- **Um único escritor por vez.** Funciona para o MVP, mas reserva, cancelamento e
  retirada acontecendo juntos disputam a trava do arquivo inteiro.
- **O banco é um arquivo.** No Docker ele precisa de volume (`DATABASE_FILE=/dados/...`
  no `Dockerfile`); em serviços gratuitos de hospedagem o disco é efêmero e os dados
  somem a cada deploy. Também falha em pastas sincronizadas (OneDrive), como o README avisa.
- **Tipos frouxos.** Datas são `TEXT`, e o `CHECK` de status não pode ser adicionado
  depois com `ALTER TABLE`.
- **Requisito da disciplina:** banco relacional migrado para PostgreSQL na Unidade 3,
  alcançável por `DATABASE_URL`, com o CI verde.

Restrição de projeto: a troca **não pode vazar para as regras de negócio**. O
`src/db.js` já expõe `query(sql, valores) → { rows }` e só ele conhece o driver.

## Alternativas consideradas

### Qual banco

| Critério | Manter SQLite | **PostgreSQL** | MySQL/MariaDB |
|---|---|---|---|
| Escritas concorrentes | 1 escritor (trava o arquivo) | MVCC, trava por linha | trava por linha (InnoDB) |
| Esforço de setup | nenhum | médio (servidor) | médio (servidor) |
| `RETURNING` (já usado no código) | sim | **sim** | não (exigiria reescrever o repositório) |
| Hospedagem gratuita gerenciada | não se aplica | Neon, Supabase, Render | poucas opções |
| Exigido pela disciplina | não | **sim** | não |

### Como subir o PostgreSQL

1. **Instalar na máquina de cada integrante** — sem Docker, mas cada um com versão e
   senha diferentes; difícil reproduzir.
2. **Contêiner (`postgres:16-alpine`) via Docker Compose** — mesma versão em todas as
   máquinas e igual ao serviço já esboçado no `ci.yml`; exige Docker instalado.
3. **Serviço gerenciado (Neon/Supabase)** — zero instalação, bom para a demo publicada;
   depende de internet, tem limite do plano gratuito e o banco fica compartilhado entre o grupo.

### Como adaptar o código

- **A. Trocar `?` por `$1, $2…` em todos os SQL** — explícito, mas espalha a mudança pelo
  `repositorio.js`, `usuarios.js` e `auth.js`.
- **B. Converter os marcadores dentro do `db.js`** — o resto do código continua igual.
- **C. Adotar um ORM (Prisma, Sequelize)** — abstrai o banco, mas reescreve toda a camada
  de dados e esconde o `UPDATE ... WHERE status = ...`, que é central (ver ADR 0002).

## Decisão

**Migrar para PostgreSQL 16, usando o driver `pg` com pool de conexões, contêiner Docker no
desenvolvimento e no CI (service container já previsto no `ci.yml`), e serviço gerenciado
(Neon) apenas para o ambiente publicado. A adaptação fica contida no `src/db.js`
(alternativa B).**

Por quê: PostgreSQL resolve a concorrência por linha, aceita `RETURNING` (o repositório não
precisa mudar de estrutura) e é o exigido. O contêiner garante a mesma versão para os quatro
integrantes e para o CI. Converter `?` → `$n` dentro do `db.js` preserva a fronteira que o
projeto já tinha e mantém os testes existentes como prova de que o comportamento não mudou.
O ORM foi descartado porque o custo de reescrever tudo é alto e a regra de concorrência ficaria
menos visível.

### O que já fizemos nesta unidade para preparar a troca

Para reduzir o custo da migração, o código novo (e o que foi tocado) **não usa funções
específicas do SQLite**:

- datas de evento (`reservada_em`, `cancelada_em`, `retirada_em`) são geradas na aplicação
  (`agoraIso()` em `src/doacoes.js`), e não com `datetime('now')` no SQL — a reserva foi
  ajustada no PR da H3;
- a data de "hoje" usada no filtro de validade vem de `hoje()` e é passada como parâmetro,
  em vez de `date('now')`;
- todas as transições de estado usam SQL padrão (`UPDATE ... WHERE ... RETURNING *`).

### Plano de execução (Unidade 3)

1. `docker-compose.yml` com `postgres:16-alpine`; `.env` com `DATABASE_URL`.
2. `db.js`: `pg.Pool`, conversão de `?` → `$n`, `alteradas` vindo de `rowCount`.
3. Schema: `INTEGER PRIMARY KEY AUTOINCREMENT` → `GENERATED ALWAYS AS IDENTITY`;
   `TEXT` de data → `DATE`/`TIMESTAMPTZ`; `datetime('now')` → `now()`;
   `garantirColuna` (`PRAGMA table_info`) → `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`;
   `CHECK (status IN (...))` na coluna de status.
4. `limparBanco()` → `TRUNCATE ... RESTART IDENTITY CASCADE`.
5. CI: descomentar o bloco `services.postgres` e `DATABASE_URL` no `ci.yml`.
6. Critério de pronto: **os mesmos 49 testes passando** antes e depois, CI verde.

## Consequências

- **Positivas:** escritas concorrentes sem travar o banco inteiro; dados persistem fora do
  contêiner da aplicação; tipos de data e `CHECK` de status no banco; o deploy publicado
  passa a ser possível.
- **Negativas / o que abrimos mão:** rodar o projeto deixa de ser só `npm install` — é preciso
  Docker (ou um `DATABASE_URL` do Neon); os testes ficam mais lentos que o SQLite em memória;
  mais uma peça para manter no CI.
- **Riscos e o que fazer se der errado:**
  - *Testes em paralelo no mesmo banco* — o Vitest roda arquivos em paralelo e o
    `limparBanco()` de um apagaria os dados de outro. Mitigação: `fileParallelism: false` no
    `vitest.config.js` (ou um schema por worker).
  - *`COUNT(*)` volta como texto (`bigint`) no `pg`* — conferir os testes que comparam contagem
    com número.
  - *Comparação de datas* — hoje a validade é `TEXT` `AAAA-MM-DD`; ao virar `DATE`, o
    parâmetro continua no mesmo formato, então o filtro do feed não muda.
  - *Rollback* — a troca fica em um único PR; se o CI não ficar verde, o PR não é integrado e a
    `main` continua em SQLite.

## Rastreabilidade

- RNF **Portabilidade/Manutenibilidade** e RNF **Consistência sob concorrência** (`docs/projeto.md`).
- Exigência da disciplina (README, "O banco: SQLite agora, PostgreSQL depois").
