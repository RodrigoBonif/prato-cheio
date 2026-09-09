import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar } from '../src/db.js';

const app = criarApp();

const restaurante = {
  nome: 'Cantina da Praça', email: 'cantina@teste.com',
  senha: 'segredo123', papel: 'restaurante'
};

beforeEach(async () => { await migrar(); await limparBanco(); });
afterAll(async () => { await encerrar(); });

describe('cadastro de usuários', () => {
  it('cadastra um restaurante e devolve o token da sessão', async () => {
    const res = await request(app).post('/api/cadastro').send(restaurante);
    expect(res.status).toBe(201);
    expect(res.body.usuario.papel).toBe('restaurante');
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario.senha).toBeUndefined();
  });

  it('cadastra uma ONG', async () => {
    const res = await request(app).post('/api/cadastro')
      .send({ nome: 'Mãos Amigas', email: 'ong@teste.com', senha: 'segredo123', papel: 'ong' });
    expect(res.status).toBe(201);
    expect(res.body.usuario.papel).toBe('ong');
  });

  it('recusa papel diferente de restaurante ou ong', async () => {
    const res = await request(app).post('/api/cadastro')
      .send({ ...restaurante, papel: 'prefeitura' });
    expect(res.status).toBe(400);
  });

  it('recusa e-mail já cadastrado', async () => {
    await request(app).post('/api/cadastro').send(restaurante);
    const res = await request(app).post('/api/cadastro').send(restaurante);
    expect(res.status).toBe(409);
  });

  it('recusa senha curta', async () => {
    const res = await request(app).post('/api/cadastro').send({ ...restaurante, senha: '123' });
    expect(res.status).toBe(400);
  });
});

describe('login e sessão', () => {
  it('entra com as credenciais corretas', async () => {
    await request(app).post('/api/cadastro').send(restaurante);
    const res = await request(app).post('/api/login')
      .send({ email: restaurante.email, senha: restaurante.senha });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('recusa senha errada', async () => {
    await request(app).post('/api/cadastro').send(restaurante);
    const res = await request(app).post('/api/login')
      .send({ email: restaurante.email, senha: 'errada' });
    expect(res.status).toBe(401);
  });

  it('identifica o usuário logado em /api/eu', async () => {
    const cadastro = await request(app).post('/api/cadastro').send(restaurante);
    const res = await request(app).get('/api/eu')
      .set('Authorization', `Bearer ${cadastro.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(restaurante.email);
  });

  it('bloqueia /api/eu sem token', async () => {
    const res = await request(app).get('/api/eu');
    expect(res.status).toBe(401);
  });
});
