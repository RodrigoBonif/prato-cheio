// Autenticação: hash de senha, sessões por token e proteção de rotas por papel.
// Sem dependência externa — usa `node:crypto`, embutido no Node.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { query } from './db.js';

export function erroHttp(mensagem, status) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

/** Gera "sal:hash" — a senha em texto puro nunca é gravada. */
export function gerarHash(senha) {
  const sal = randomBytes(16).toString('hex');
  return `${sal}:${scryptSync(senha, sal, 32).toString('hex')}`;
}

export function conferirSenha(senha, guardado) {
  const [sal, hash] = String(guardado || '').split(':');
  if (!sal || !hash) return false;
  const calculado = scryptSync(senha, sal, 32);
  const esperado = Buffer.from(hash, 'hex');
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

export async function abrirSessao(usuarioId) {
  const token = randomBytes(24).toString('hex');
  await query('INSERT INTO sessoes (token, usuario_id) VALUES (?, ?)', [token, usuarioId]);
  return token;
}

export async function encerrarSessao(token) {
  await query('DELETE FROM sessoes WHERE token = ?', [token]);
}

export async function usuarioDoToken(token) {
  if (!token) return undefined;
  const { rows } = await query(
    `SELECT u.id, u.nome, u.email, u.papel, u.telefone, u.endereco
       FROM sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token = ?`,
    [token]
  );
  return rows[0];
}

function tokenDoPedido(req) {
  const cabecalho = req.get('authorization') || '';
  return cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : undefined;
}

/** Exige um usuário logado; coloca-o em req.usuario. */
export function exigirLogin() {
  return async (req, res, next) => {
    const usuario = await usuarioDoToken(tokenDoPedido(req));
    if (!usuario) return res.status(401).json({ erro: 'faça login para continuar' });
    req.usuario = usuario;
    next();
  };
}

/** Exige um papel específico ('restaurante' ou 'ong'). */
export function exigirPapel(papel) {
  return async (req, res, next) => {
    const usuario = await usuarioDoToken(tokenDoPedido(req));
    if (!usuario) return res.status(401).json({ erro: 'faça login para continuar' });
    if (usuario.papel !== papel) {
      return res.status(403).json({ erro: `esta ação é exclusiva do perfil ${papel}` });
    }
    req.usuario = usuario;
    next();
  };
}
