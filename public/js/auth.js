// Telas de cadastro e login.
import { api, guardarToken, apagarToken, lerToken } from './api.js';

const $ = (id) => document.getElementById(id);

function mostrarAviso(texto, tipo = 'erro') {
  const aviso = $('aviso-auth');
  aviso.textContent = texto;
  aviso.className = `aviso ${tipo}`;
  aviso.classList.toggle('escondido', !texto);
}

export function ligarTelaAuth(aoEntrar) {
  $('aba-login').onclick = () => trocarAba('login');
  $('aba-cadastro').onclick = () => trocarAba('cadastro');

  $('form-login').onclick = async () => {
    try {
      mostrarAviso('');
      const { usuario, token } = await api('/login', {
        metodo: 'POST',
        corpo: { email: $('login-email').value, senha: $('login-senha').value }
      });
      guardarToken(token);
      aoEntrar(usuario);
    } catch (erro) { mostrarAviso(erro.message); }
  };

  $('form-cadastro').onclick = async () => {
    try {
      mostrarAviso('');
      const { usuario, token } = await api('/cadastro', {
        metodo: 'POST',
        corpo: {
          nome: $('cad-nome').value,
          email: $('cad-email').value,
          senha: $('cad-senha').value,
          papel: $('cad-papel').value,
          telefone: $('cad-telefone').value,
          endereco: $('cad-endereco').value
        }
      });
      guardarToken(token);
      aoEntrar(usuario);
    } catch (erro) { mostrarAviso(erro.message); }
  };
}

function trocarAba(aba) {
  mostrarAviso('');
  $('aba-login').classList.toggle('ativa', aba === 'login');
  $('aba-cadastro').classList.toggle('ativa', aba === 'cadastro');
  $('painel-login').classList.toggle('escondido', aba !== 'login');
  $('painel-cadastro').classList.toggle('escondido', aba !== 'cadastro');
}

/** Se já existe token salvo, recupera o usuário da sessão. */
export async function sessaoAtual() {
  if (!lerToken()) return undefined;
  try { return await api('/eu'); } catch { apagarToken(); return undefined; }
}

export async function sair() {
  try { await api('/logout', { metodo: 'POST' }); } catch { /* sessão já expirada */ }
  apagarToken();
}
