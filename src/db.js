// Conexão com o banco.
//
// UNIDADE 1: SQLite, embutido no Node (módulo `node:sqlite`) — nada para instalar.
// UNIDADE 3: este arquivo será refatorado para PostgreSQL. A interface abaixo
//            (`query` devolvendo `{ rows }`) foi desenhada para que a troca fique
//            contida aqui, sem espalhar mudança pelo resto do código.
import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

const ARQUIVO = process.env.DATABASE_FILE || 'dados.sqlite';

let db;

export function conexao() {
  if (!db) db = new DatabaseSync(ARQUIVO);
  return db;
}

/**
 * Executa uma consulta e devolve { rows }.
 * Use `?` como marcador de parâmetro (evita injeção de SQL):
 *   query('SELECT * FROM doacoes WHERE id = ?', [id])
 */
export async function query(sql, valores = []) {
  const stmt = conexao().prepare(sql);
  const ehLeitura = /^\s*(select|with)/i.test(sql) || /returning/i.test(sql);
  if (ehLeitura) return { rows: stmt.all(...valores) };
  const info = stmt.run(...valores);
  return { rows: [], alteradas: info.changes };
}

/** Adiciona uma coluna só se ela ainda não existir (bancos criados antes do MVP). */
function garantirColuna(tabela, coluna, definicao) {
  const colunas = conexao().prepare(`PRAGMA table_info(${tabela})`).all();
  if (!colunas.some((c) => c.name === coluna)) {
    conexao().exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}

/** Cria o schema, se ainda não existir. Rodado por `npm run db:migrar` e ao subir o servidor. */
export async function migrar() {
  conexao().exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nome       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      senha      TEXT NOT NULL,
      papel      TEXT NOT NULL CHECK (papel IN ('restaurante', 'ong')),
      telefone   TEXT,
      endereco   TEXT,
      criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessoes (
      token       TEXT PRIMARY KEY,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
      criada_em   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doacoes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurante_id  INTEGER REFERENCES usuarios(id),
      tipo            TEXT NOT NULL,
      quantidade      TEXT NOT NULL,
      validade        TEXT NOT NULL,
      descricao       TEXT,
      retirada        TEXT,
      status          TEXT NOT NULL DEFAULT 'disponivel',
      ong_id          INTEGER REFERENCES usuarios(id),
      reservada_em    TEXT,
      criada_em       TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Bancos criados na versão anterior do esqueleto não têm estas colunas.
  garantirColuna('doacoes', 'restaurante_id', 'INTEGER');
  garantirColuna('doacoes', 'descricao', 'TEXT');
  garantirColuna('doacoes', 'retirada', 'TEXT');
  garantirColuna('doacoes', 'ong_id', 'INTEGER');
  garantirColuna('doacoes', 'reservada_em', 'TEXT');
}

/** Apaga todos os dados. Usado pelos testes. */
export async function limparBanco() {
  conexao().exec('DELETE FROM doacoes; DELETE FROM sessoes; DELETE FROM usuarios;');
}

export async function encerrar() {
  if (db) { db.close(); db = undefined; }
}
