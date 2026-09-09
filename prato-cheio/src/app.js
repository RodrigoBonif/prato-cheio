import express from 'express';
import * as doacoes from './doacoes.js';
import * as usuarios from './usuarios.js';
import { encerrarSessao, exigirLogin, exigirPapel } from './auth.js';

function responderErro(res, erro) {
  res.status(erro.status || 400).json({ erro: erro.message });
}

export function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static('public'));

  // Verificação de saúde: usada pelo CI para provar que a aplicação sobe.
  app.get('/api/saude', (req, res) => res.json({ ok: true }));

  // ----- Cadastro, login e sessão -------------------------------------------
  app.post('/api/cadastro', async (req, res) => {
    try {
      res.status(201).json(await usuarios.cadastrar(req.body || {}));
    } catch (erro) {
      responderErro(res, erro);
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      res.json(await usuarios.entrar(req.body || {}));
    } catch (erro) {
      responderErro(res, erro);
    }
  });

  app.post('/api/logout', exigirLogin(), async (req, res) => {
    await encerrarSessao((req.get('authorization') || '').slice(7).trim());
    res.json({ ok: true });
  });

  app.get('/api/eu', exigirLogin(), (req, res) => res.json(req.usuario));

  // ----- Doações -------------------------------------------------------------
  app.get('/api/doacoes', async (req, res) => {
    try {
      res.json(await doacoes.listarDisponiveis());
    } catch (erro) {
      responderErro(res, erro);
    }
  });

  // Só o perfil Restaurante publica doações.
  app.post('/api/doacoes', exigirPapel('restaurante'), async (req, res) => {
    try {
      res.status(201).json(await doacoes.criarDoacao(req.body || {}, req.usuario));
    } catch (erro) {
      responderErro(res, erro);
    }
  });

  // Painel do restaurante: as doações que ele mesmo publicou.
  app.get('/api/doacoes/minhas', exigirPapel('restaurante'), async (req, res) => {
    try {
      res.json(await doacoes.listarDoRestaurante(req.usuario.id));
    } catch (erro) {
      responderErro(res, erro);
    }
  });

  return app;
}
