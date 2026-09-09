// Regras de negócio das doações.
import * as repo from './repositorio.js';
import { erroHttp } from './auth.js';

/** Um restaurante publica uma doação. Tipo, quantidade e validade são obrigatórios. */
export async function criarDoacao({ tipo, quantidade, validade, descricao, retirada }, restaurante) {
  if (!restaurante || restaurante.papel !== 'restaurante') {
    throw erroHttp('apenas restaurantes podem publicar doações', 403);
  }
  if (!tipo || !String(tipo).trim()) throw erroHttp('informe o tipo de alimento', 400);
  if (!quantidade || !String(quantidade).trim()) throw erroHttp('informe a quantidade', 400);
  if (!validade || !String(validade).trim()) throw erroHttp('informe a validade', 400);

  return repo.inserir({
    restaurante_id: restaurante.id,
    tipo: String(tipo).trim(),
    quantidade: String(quantidade).trim(),
    validade: String(validade).trim(),
    descricao: descricao ? String(descricao).trim() : null,
    retirada: retirada ? String(retirada).trim() : null
  });
}

/** Doações publicadas pelo restaurante logado. */
export async function listarDoRestaurante(restauranteId) {
  return repo.listarPorRestaurante(restauranteId);
}

/** Uma ONG vê as doações disponíveis. */
export async function listarDisponiveis() {
  return repo.listarDisponiveis();
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
