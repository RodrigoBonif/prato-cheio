// Cliente HTTP da aplicação: guarda o token da sessão e fala com /api.
const CHAVE = 'pratocheio:token';

export function guardarToken(token) { localStorage.setItem(CHAVE, token); }
export function lerToken() { return localStorage.getItem(CHAVE); }
export function apagarToken() { localStorage.removeItem(CHAVE); }

export async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const cabecalhos = { 'Content-Type': 'application/json' };
  const token = lerToken();
  if (token) cabecalhos.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: corpo ? JSON.stringify(corpo) : undefined
  });

  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(dados.erro || 'não foi possível concluir a ação');
  return dados;
}
