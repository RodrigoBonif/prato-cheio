// Painel da ONG: feed de doações disponíveis e reservas feitas.
import { api } from './api.js';
import { escapar, selo, vazio, carregando, dataBr } from './ui.js';

const $ = (id) => document.getElementById(id);

const MODELO = `
  <div class="abas">
    <button id="aba-feed" class="ativa">Disponíveis</button>
    <button id="aba-reservas">Minhas reservas</button>
  </div>
  <p id="ong-aviso" class="aviso escondido"></p>
  <div id="ong-lista"></div>
`;

function aviso(texto, tipo = 'erro') {
  const el = $('ong-aviso');
  el.textContent = texto;
  el.className = `aviso ${tipo}`;
  el.classList.toggle('escondido', !texto);
}

function cartaoDoacao(d, { comBotao }) {
  return `
    <div class="cartao">
      <div class="titulo">${escapar(d.tipo)}${comBotao ? '' : selo(d.status)}</div>
      <div class="linha">${escapar(d.quantidade)} · até ${dataBr(d.validade)}</div>
      ${d.retirada ? `<div class="linha">Retirada: ${escapar(d.retirada)}</div>` : ''}
      ${d.descricao ? `<div class="linha">${escapar(d.descricao)}</div>` : ''}
      <div class="linha">${escapar(d.restaurante_nome || 'Restaurante')}${
        d.restaurante_endereco ? ` · ${escapar(d.restaurante_endereco)}` : ''}</div>
      ${comBotao
        ? `<button data-reservar="${d.id}">Reservar doação</button>`
        : `<div class="linha">Contato: ${escapar(d.restaurante_telefone || 'combinar por e-mail')}</div>`}
    </div>
  `;
}

async function mostrarFeed() {
  const lista = $('ong-lista');
  lista.innerHTML = carregando();
  try {
    const doacoes = await api('/doacoes');
    lista.innerHTML = doacoes.length
      ? doacoes.map((d) => cartaoDoacao(d, { comBotao: true })).join('')
      : vazio('Nenhuma doação disponível no momento. Volte em instantes.');

    for (const botao of lista.querySelectorAll('[data-reservar]')) {
      botao.onclick = async () => {
        botao.disabled = true;
        botao.textContent = 'Reservando…';
        try {
          aviso('');
          await api(`/doacoes/${botao.dataset.reservar}/reservar`, { metodo: 'POST' });
          aviso('Doação reservada. Combine a retirada com o restaurante.', 'ok');
        } catch (erro) {
          aviso(erro.message);
        }
        await mostrarFeed();
      };
    }
  } catch (erro) {
    lista.innerHTML = vazio(erro.message);
  }
}

async function mostrarReservas() {
  const lista = $('ong-lista');
  lista.innerHTML = carregando();
  try {
    const reservas = await api('/reservas');
    lista.innerHTML = reservas.length
      ? reservas.map((d) => cartaoDoacao(d, { comBotao: false })).join('')
      : vazio('Você ainda não reservou nenhuma doação.');
  } catch (erro) {
    lista.innerHTML = vazio(erro.message);
  }
}

export async function montarPainelOng() {
  const tela = $('tela-ong');
  tela.innerHTML = MODELO;

  const trocar = async (aba) => {
    aviso('');
    $('aba-feed').classList.toggle('ativa', aba === 'feed');
    $('aba-reservas').classList.toggle('ativa', aba === 'reservas');
    await (aba === 'feed' ? mostrarFeed() : mostrarReservas());
  };

  $('aba-feed').onclick = () => trocar('feed');
  $('aba-reservas').onclick = () => trocar('reservas');

  await mostrarFeed();
}
