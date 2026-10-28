// Regras de negócio das doações.
import * as repo from './repositorio.js';
import { erroHttp } from './auth.js';

/**
 * Data de hoje no formato AAAA-MM-DD, no fuso local do servidor.
 * Calculada aqui (e não com `date('now')` no SQL) para não prender a regra a uma
 * função específica do SQLite — ver docs/adr/0001-migracao-sqlite-postgresql.md.
 */
export function hoje(agora = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

/** Aceita só datas reais no formato AAAA-MM-DD (rejeita 2026-02-30, "amanhã" etc.). */
function ehDataValida(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1
    && d.getDate() === Number(m[3]);
}

/** Um restaurante publica uma doação. Tipo, quantidade e validade são obrigatórios. */
export async function criarDoacao({ tipo, quantidade, validade, descricao, retirada }, restaurante) {
  if (!restaurante || restaurante.papel !== 'restaurante') {
    throw erroHttp('apenas restaurantes podem publicar doações', 403);
  }
  if (!tipo || !String(tipo).trim()) throw erroHttp('informe o tipo de alimento', 400);
  if (!quantidade || !String(quantidade).trim()) throw erroHttp('informe a quantidade', 400);
  if (!validade || !String(validade).trim()) throw erroHttp('informe a validade', 400);
  const validadeTexto = String(validade).trim();
  if (!ehDataValida(validadeTexto)) {
    throw erroHttp('informe a validade no formato AAAA-MM-DD', 400);
  }
  if (validadeTexto < hoje()) {
    throw erroHttp('a validade não pode estar no passado', 400);
  }

  return repo.inserir({
    restaurante_id: restaurante.id,
    tipo: String(tipo).trim(),
    quantidade: String(quantidade).trim(),
    validade: validadeTexto,
    descricao: descricao ? String(descricao).trim() : null,
    retirada: retirada ? String(retirada).trim() : null
  });
}

/** Doações publicadas pelo restaurante logado. */
export async function listarDoRestaurante(restauranteId) {
  return repo.listarPorRestaurante(restauranteId);
}

/** Uma ONG vê as doações disponíveis — as vencidas não aparecem mais no feed. */
export async function listarDisponiveis() {
  return repo.listarDisponiveis(hoje());
}

/** Doações já reservadas pela ONG logada. */
export async function listarReservas(ongId) {
  return repo.listarPorOng(ongId);
}

/**
 * Uma ONG reserva uma doação.
 * Regra do caso: uma doação reservada não fica disponível para outra ONG.
 */
export async function reservar(id, ong) {
  if (!ong || ong.papel !== 'ong') {
    throw erroHttp('apenas ONGs podem reservar doações', 403);
  }
  const doacao = await repo.buscarPorId(id);
  if (!doacao) throw erroHttp('doação não encontrada', 404);

  const reservada = await repo.reservar(id, ong.id);
  if (!reservada) throw erroHttp('esta doação já foi reservada por outra ONG', 409);
  return reservada;
}
