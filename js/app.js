// Ponto de entrada da interface: decide qual tela mostrar conforme o papel.
import { ligarTelaAuth, sessaoAtual, sair } from './auth.js';
import { montarPainelRestaurante } from './restaurante.js';

const $ = (id) => document.getElementById(id);
let usuarioAtual;

function mostrarTela(nome) {
  for (const tela of ['auth', 'restaurante', 'ong']) {
    $(`tela-${tela}`).classList.toggle('escondido', tela !== nome);
  }
  $('barra-usuario').classList.toggle('escondido', nome === 'auth');
}

async function entrar(usuario) {
  usuarioAtual = usuario;
  $('nome-usuario').textContent = usuario.nome;
  $('papel-usuario').textContent = usuario.papel === 'restaurante' ? 'Restaurante' : 'ONG';
  mostrarTela(usuario.papel);
  if (usuario.papel === 'restaurante') await montarPainelRestaurante();
}

async function iniciar() {
  ligarTelaAuth(entrar);
  $('botao-sair').onclick = async () => {
    await sair();
    usuarioAtual = undefined;
    mostrarTela('auth');
  };

  const usuario = await sessaoAtual();
  if (usuario) entrar(usuario); else mostrarTela('auth');
}

iniciar();
