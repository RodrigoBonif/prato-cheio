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

/** Doações ainda disponíveis, com os dados do restaurante que publicou. */
export async function listarDisponiveis() {
  const { rows } = await query(
    `SELECT d.*, r.nome AS restaurante_nome, r.endereco AS restaurante_endereco,
            r.telefone AS restaurante_telefone
       FROM doacoes d
       LEFT JOIN usuarios r ON r.id = d.restaurante_id
      WHERE d.status = 'disponivel'
      ORDER BY d.validade ASC, d.id DESC`
  );
  return rows;
}

/** Doações já reservadas por uma ONG. */
export async function listarPorOng(ongId) {
  const { rows } = await query(
    `SELECT d.*, r.nome AS restaurante_nome, r.endereco AS restaurante_endereco,
            r.telefone AS restaurante_telefone
       FROM doacoes d
       LEFT JOIN usuarios r ON r.id = d.restaurante_id
      WHERE d.ong_id = ?
      ORDER BY d.reservada_em DESC`,
    [ongId]
  );
  return rows;
}

/**
 * Reserva a doação para a ONG e devolve a linha atualizada.
 * O filtro `status = 'disponivel'` dentro do UPDATE é o que impede duas ONGs
 * de reservarem a mesma doação: a segunda não altera nenhuma linha.
 */
export async function reservar(id, ongId) {
  const { rows } = await query(
    `UPDATE doacoes
        SET status = 'reservada', ong_id = ?, reservada_em = datetime('now')
      WHERE id = ? AND status = 'disponivel'
      RETURNING *`,
    [ongId, id]
  );
  return rows[0];
}
