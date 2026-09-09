// Peças de interface compartilhadas pelos dois painéis.

/** Impede que texto digitado pelo usuário quebre (ou injete) HTML na tela. */
export function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function selo(status) {
  const reservada = status === 'reservada';
  return `<span class="selo ${reservada ? 'reservada' : 'disponivel'}">${
    reservada ? 'Reservada' : 'Disponível'}</span>`;
}

export function vazio(mensagem) {
  return `<div class="cartao vazio">${escapar(mensagem)}</div>`;
}

export function carregando() {
  return '<div class="cartao vazio">Carregando…</div>';
}

/** Mostra a data no formato brasileiro; se vier vazia ou inválida, devolve o original. */
export function dataBr(iso) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : escapar(iso);
}
