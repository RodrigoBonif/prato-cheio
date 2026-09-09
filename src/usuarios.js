// Regras de negócio de cadastro e login.
import { query } from './db.js';
import { gerarHash, conferirSenha, abrirSessao, erroHttp } from './auth.js';

const PAPEIS = ['restaurante', 'ong'];

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validarCadastro({ nome, email, senha, papel }) {
  if (!nome || !String(nome).trim()) throw erroHttp('informe o nome', 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizarEmail(email))) {
    throw erroHttp('informe um e-mail válido', 400);
  }
  if (!senha || String(senha).length < 6) {
    throw erroHttp('a senha precisa ter ao menos 6 caracteres', 400);
  }
  if (!PAPEIS.includes(papel)) throw erroHttp('escolha o perfil: restaurante ou ong', 400);
}

export async function cadastrar({ nome, email, senha, papel, telefone, endereco }) {
  validarCadastro({ nome, email, senha, papel });
  const emailNormalizado = normalizarEmail(email);

  const existente = await query('SELECT id FROM usuarios WHERE email = ?', [emailNormalizado]);
  if (existente.rows.length) throw erroHttp('já existe uma conta com esse e-mail', 409);

  const { rows } = await query(
    `INSERT INTO usuarios (nome, email, senha, papel, telefone, endereco)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING id, nome, email, papel, telefone, endereco`,
    [String(nome).trim(), emailNormalizado, gerarHash(String(senha)), papel,
     telefone || null, endereco || null]
  );

  const usuario = rows[0];
  return { usuario, token: await abrirSessao(usuario.id) };
}

export async function entrar({ email, senha }) {
  const { rows } = await query('SELECT * FROM usuarios WHERE email = ?', [normalizarEmail(email)]);
  const registro = rows[0];
  if (!registro || !conferirSenha(String(senha || ''), registro.senha)) {
    throw erroHttp('e-mail ou senha inválidos', 401);
  }
  const usuario = {
    id: registro.id, nome: registro.nome, email: registro.email,
    papel: registro.papel, telefone: registro.telefone, endereco: registro.endereco
  };
  return { usuario, token: await abrirSessao(usuario.id) };
}
