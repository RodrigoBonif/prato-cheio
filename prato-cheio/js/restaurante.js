// Painel do Restaurante: publicar doação e acompanhar as próprias doações.
import { api } from './api.js';

const $ = (id) => document.getElementById(id);

const MODELO = `
  <div class="cartao">
    <h2>Publicar doação</h2>
    <label for="doa-tipo">Tipo de alimento</label>
    <input id="doa-tipo" placeholder="Ex.: marmitas, pães, frutas">
    <label for="doa-quantidade">Quantidade</label>
    <input id="doa-quantidade" placeholder="Ex.: 20 porções">
    <label for="doa-validade">Consumir / retirar até</label>
    <input id="doa-validade" type="date">
    <label for="doa-retirada">Janela de retirada</label>
    <input id="doa-retirada" placeholder="Ex.: hoje, das 18h às 20h">
    <label for="doa-descricao">Descrição (opcional)</label>
    <textarea id="doa-descricao" placeholder="Refrigeração, embalagem, observações"></textarea>
    <button id="doa-publicar">Publicar doação</button>
    <p id="doa-aviso" class="aviso escondido"></p>
  </div>

  <h2>Minhas doações</h2>
  <div id="minhas-doacoes"></div>
`;

function aviso(texto, tipo = 'erro') {
  const el = $('doa-aviso');
  el.textContent = texto;
  el.className = `aviso ${tipo}`;
  el.classList.toggle('escondido', !texto);
}

function limparFormulario() {
  for (const id of ['doa-tipo', 'doa-quantidade', 'doa-validade', 'doa-retirada', 'doa-descricao']) {
    $(id).value = '';
  }
}

async function carregarMinhas() {
  const alvo = $('minhas-doacoes');
  const doacoes = await api('/doacoes/minhas');
  if (!doacoes.length) {
    alvo.innerHTML = '<div class="cartao">Você ainda não publicou nenhuma doação.</div>';
    return;
  }
  alvo.innerHTML = doacoes.map((d) => `
    <div class="cartao">
      <strong>${d.tipo}</strong> — ${d.quantidade}
      <div>Até ${d.validade}${d.retirada ? ` · ${d.retirada}` : ''}</div>
      ${d.descricao ? `<div>${d.descricao}</div>` : ''}
      <div>${d.status === 'reservada'
        ? `Reservada por ${d.ong_nome || 'uma ONG'}${d.ong_telefone ? ` · ${d.ong_telefone}` : ''}`
        : 'Disponível'}</div>
    </div>
  `).join('');
}

export async function montarPainelRestaurante() {
  const tela = $('tela-restaurante');
  tela.innerHTML = MODELO;

  $('doa-publicar').onclick = async () => {
    try {
      aviso('');
      await api('/doacoes', {
        metodo: 'POST',
        corpo: {
          tipo: $('doa-tipo').value,
          quantidade: $('doa-quantidade').value,
          validade: $('doa-validade').value,
          retirada: $('doa-retirada').value,
          descricao: $('doa-descricao').value
        }
      });
      limparFormulario();
      aviso('Doação publicada. As ONGs já podem vê-la.', 'ok');
      await carregarMinhas();
    } catch (erro) { aviso(erro.message); }
  };

  await carregarMinhas();
}
