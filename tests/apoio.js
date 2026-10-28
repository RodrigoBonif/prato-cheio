// Utilitários compartilhados pelos testes.
import { hoje } from '../src/doacoes.js';

/** Data AAAA-MM-DD deslocada `dias` a partir de hoje (negativo = passado). */
export function emDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return hoje(d);
}
