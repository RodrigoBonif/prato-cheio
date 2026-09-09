# Prato Cheio - 

Projeto da disciplina **Análise, Projeto e Desenvolvimento Ágil**.
Conecta doadores de alimentos excedentes a ONGs, antes que a comida se perca.

> Este repositório é a base do produto que evolui nas três unidades:
> walking skeleton (U1) → incremento guiado pelo projeto (U2) → produto refatorado (U3).

## Integrantes
- Bianca Barp — @bBarp
- Vinícius Clemente Negherbon — @nnegherbon
- Ruan Pablo de Lima Pereira — @ruanplp123
- Rodrigo Bonifácio Conceição

## Como rodar

Requisito: **Node.js 22.13 ou superior**. Mais nada — o banco da Unidade 1 é SQLite, embutido no próprio Node.

> Esta é a **stack preferencial** da disciplina. Se o seu grupo optar por outra, registre o ADR de justificativa e garanta os mesmos compromissos: repositório público com CI verde, rota de saúde, testes por um comando, os três comandos documentados aqui no README e banco relacional migrado para PostgreSQL na Unidade 3.

```bash
npm install       # só na primeira vez
npm run db:migrar # cria o schema (arquivo dados.sqlite)
npm start         # sobe em http://localhost:3000
npm test          # roda os testes
npm run dev       # sobe recarregando a cada alteração
```

Os testes usam SQLite **em memória**, então não sujam o banco de desenvolvimento.

> Ao rodar `npm test` o Node imprime `ExperimentalWarning: SQLite is an experimental feature`.
> É esperado — o módulo embutido `node:sqlite` ainda é marcado como experimental. Não é erro e não reprova o CI.

> **Atenção:** não deixe o repositório dentro de uma pasta sincronizada (OneDrive, Google Drive, Dropbox) nem em disco de rede. O SQLite precisa de trava de arquivo e nesses lugares falha com `disk I/O error`. Clone em uma pasta local comum, por exemplo `~/dev/`.

## O banco: SQLite agora, PostgreSQL depois

| Unidade | Banco | O que precisa instalar |
|---|---|---|
| 1 — Análise | **SQLite** (`node:sqlite`, embutido) | nada além do Node |
| 2 — Projeto | SQLite | nada |
| 3 — Construção | **PostgreSQL** (após refatorar) | um PostgreSQL acessível — o caminho é escolha do grupo |

A troca não é acidente de percurso: na Unidade 2 vocês registram a decisão em um **ADR** (alternativas, consequências, riscos) e na Unidade 3 executam a **refatoração** — com os testes existentes provando que o comportamento se manteve.

O `src/db.js` foi desenhado para isso: ele expõe `query()` devolvendo `{ rows }`, então a troca do banco fica contida nele e não vaza para as regras de negócio.

**Como o PostgreSQL vai subir é decisão do grupo**, comparada no mesmo ADR: instalar o PostgreSQL na máquina, subir um contêiner, ou usar um serviço gerenciado gratuito (Neon, Supabase, Render). A disciplina não impõe o caminho — exige o banco alcançável por `DATABASE_URL`, o schema migrado e o CI verde. Cada opção tem custo e risco diferentes, e reconhecê-los é parte da decisão.

## Estrutura

```
src/server.js          entrypoint (npm start)
src/db.js              conexão e schema do banco
src/auth.js            hash de senha, sessão por token e proteção por papel
src/usuarios.js        regras de cadastro e login
src/app.js             rotas da API
src/doacoes.js         regras de negócio das doações
src/repositorio.js     acesso ao banco (SQL)
public/index.html      interface (funciona no celular)
public/estilo.css      estilos
public/js/api.js       cliente HTTP + token da sessão
public/js/auth.js      telas de cadastro e login
public/js/restaurante.js  painel do Restaurante
public/js/ong.js       painel da ONG
public/js/ui.js        peças de interface compartilhadas
tests/                 testes automatizados
docs/analise.md        documento de análise   (Trabalho 1)
```

## O MVP

Um fluxo, de ponta a ponta:

1. **Cadastro e login** com dois perfis: `restaurante` e `ong`.
2. O **Restaurante** publica uma doação (tipo, quantidade, validade, janela de retirada, descrição).
3. A **ONG** vê as doações disponíveis e **reserva** uma delas — que sai imediatamente do feed das outras ONGs.

### Rotas

| Método | Rota | Quem pode |
|---|---|---|
| GET | `/api/saude` | qualquer um |
| POST | `/api/cadastro` | qualquer um |
| POST | `/api/login` | qualquer um |
| POST | `/api/logout` | logado |
| GET | `/api/eu` | logado |
| GET | `/api/doacoes` | logado (feed de disponíveis) |
| POST | `/api/doacoes` | restaurante |
| GET | `/api/doacoes/minhas` | restaurante |
| POST | `/api/doacoes/:id/reservar` | ong |
| GET | `/api/reservas` | ong |

Autenticação por token: o cadastro e o login devolvem `token`, enviado depois no cabeçalho
`Authorization: Bearer <token>`. A senha é gravada como hash `scrypt` (`node:crypto`) — nunca em texto puro.

### Como a corrida entre duas ONGs é evitada

A reserva é um único `UPDATE ... WHERE id = ? AND status = 'disponivel'`. Se duas ONGs
clicarem ao mesmo tempo, a segunda não altera nenhuma linha e recebe `409`.
