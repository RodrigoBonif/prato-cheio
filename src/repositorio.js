// Camada de dados do Prato Cheio — acesso ao banco.
// Marcador de parâmetro é `?` (SQL parametrizado evita injeção).
import { query } from './db.js';

/** Insere a doação e devolve a linha criada. */
export async function inserir({ restaurante_id, tipo, quantidade, validade, descricao, retirada }) {
  const { rows } = await query(
    `INSERT INTO doacoes (restaurante_id, tipo, quantidade, validade, descricao, retirada)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING *`,
    [restaurante_id, tipo, quantidade, validade, descricao || null, retirada || null]
  );
  return rows[0];
}

/** Busca uma doação pelo id (undefined se não existir). */
export async function buscarPorId(id) {
  const { rows } = await query('SELECT * FROM doacoes WHERE id = ?', [id]);
  return rows[0];
}

/** Doações publicadas por um restaurante, das mais recentes para as mais antigas. */
export async function listarPorRestaurante(restauranteId) {
  const { rows } = await query(
    `SELECT d.*, o.nome AS ong_nome, o.telefone AS ong_telefone
       FROM doacoes d
       LEFT JOIN usuarios o ON o.id = d.ong_id
      WHERE d.restaurante_id = ?
      ORDER BY d.id DESC`,
    [restauranteId]
  );
  return rows;
}

// TODO (commit 3): listarDisponiveis e reservar.
