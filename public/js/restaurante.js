// Painel do Restaurante: publicar doação e acompanhar as próprias doações.
import { api } from './api.js';
import { escapar, selo, vazio, carregando, dataBr } from './ui.js';

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
  alvo.innerHTML = carregando();
  try {
    const doacoes = await api('/doacoes/minhas');
    if (!doacoes.length) {
      alvo.innerHTML = vazio('Você ainda não publicou nenhuma doação.');
      return;
    }
    alvo.innerHTML = doacoes.map((d) => `
      <div class="cartao">
        <div class="titulo">${escapar(d.tipo)}${selo(d.status)}</div>
        <div class="linha">${escapar(d.quantidade)} · até ${dataBr(d.validade)}</div>
        ${d.retirada ? `<div class="linha">Retirada: ${escapar(d.retirada)}</div>` : ''}
        ${d.descricao ? `<div class="linha">${escapar(d.descricao)}</div>` : ''}
        ${d.status === 'reservada'
          ? `<div class="linha">Reservada por ${escapar(d.ong_nome || 'uma ONG')}${
              d.ong_telefone ? ` · ${escapar(d.ong_telefone)}` : ''}</div>`
          : ''}
      </div>
    `).join('');
  } catch (erro) {
    alvo.innerHTML = vazio(erro.message);
  }
}

export async function montarPainelRestaurante() {
  const tela = $('tela-restaurante');
  tela.innerHTML = MODELO;

  $('doa-publicar').onclick = async (evento) => {
    const botao = evento.currentTarget;
    botao.disabled = true;
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
    } catch (erro) {
      aviso(erro.message);
    } finally {
      botao.disabled = false;
    }
  };

  await carregarMinhas();
}
