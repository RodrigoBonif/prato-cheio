import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar } from '../src/db.js';

const app = criarApp();

async function criarConta(dados) {
  const res = await request(app).post('/api/cadastro').send(dados);
  return res.body.token;
}

const contaRestaurante = () => criarConta({
  nome: 'Cantina da Praça', email: 'cantina@teste.com', senha: 'segredo123', papel: 'restaurante'
});
const contaOng = () => criarConta({
  nome: 'Mãos Amigas', email: 'ong@teste.com', senha: 'segredo123', papel: 'ong'
});

const doacaoValida = { tipo: 'Marmitas', quantidade: '20 porções', validade: '2026-12-01' };

beforeEach(async () => { await migrar(); await limparBanco(); });
afterAll(async () => { await encerrar(); });

// Este teste não depende do banco: prova que a aplicação sobe e que o CI funciona.
describe('a aplicação sobe', () => {
  it('responde na verificação de saúde', async () => {
    const res = await request(app).get('/api/saude');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('publicar doação', () => {
  it('o restaurante publica uma doação', async () => {
    const token = await contaRestaurante();
    const res = await request(app).post('/api/doacoes')
      .set('Authorization', `Bearer ${token}`).send(doacaoValida);
    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe('Marmitas');
    expect(res.body.status).toBe('disponivel');
  });

  it('recusa doação sem os campos obrigatórios', async () => {
    const token = await contaRestaurante();
    const res = await request(app).post('/api/doacoes')
      .set('Authorization', `Bearer ${token}`).send({ tipo: 'Marmitas' });
    expect(res.status).toBe(400);
  });

  it('exige login para publicar', async () => {
    const res = await request(app).post('/api/doacoes').send(doacaoValida);
    expect(res.status).toBe(401);
  });

  it('bloqueia ONG publicando doação', async () => {
    const token = await contaOng();
    const res = await request(app).post('/api/doacoes')
      .set('Authorization', `Bearer ${token}`).send(doacaoValida);
    expect(res.status).toBe(403);
  });
});

describe('painel do restaurante', () => {
  it('lista apenas as doações do próprio restaurante', async () => {
    const token = await contaRestaurante();
    await request(app).post('/api/doacoes')
      .set('Authorization', `Bearer ${token}`).send(doacaoValida);

    const outro = await criarConta({
      nome: 'Bistrô', email: 'bistro@teste.com', senha: 'segredo123', papel: 'restaurante'
    });
    await request(app).post('/api/doacoes')
      .set('Authorization', `Bearer ${outro}`).send({ ...doacaoValida, tipo: 'Sopa' });

    const res = await request(app).get('/api/doacoes/minhas')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tipo).toBe('Marmitas');
  });
});

describe('reservar uma doação', () => {
  async function publicarDoacao() {
    const token = await contaRestaurante();
    const res = await request(app).post('/api/doacoes')
      .set('Authorization', `Bearer ${token}`).send(doacaoValida);
    return res.body.id;
  }

  it('a ONG vê a doação na lista de disponíveis', async () => {
    await publicarDoacao();
    const ong = await contaOng();
    const res = await request(app).get('/api/doacoes').set('Authorization', `Bearer ${ong}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].restaurante_nome).toBe('Cantina da Praça');
  });

  it('a ONG reserva a doação e ela sai da lista de disponíveis', async () => {
    const id = await publicarDoacao();
    const ong = await contaOng();

    const reserva = await request(app).post(`/api/doacoes/${id}/reservar`)
      .set('Authorization', `Bearer ${ong}`);
    expect(reserva.status).toBe(200);
    expect(reserva.body.status).toBe('reservada');

    const feed = await request(app).get('/api/doacoes').set('Authorization', `Bearer ${ong}`);
    expect(feed.body).toHaveLength(0);

    const minhas = await request(app).get('/api/reservas').set('Authorization', `Bearer ${ong}`);
    expect(minhas.body).toHaveLength(1);
  });

  it('recusa reservar uma doação já reservada por outra ONG', async () => {
    const id = await publicarDoacao();
    const primeira = await contaOng();
    const segunda = await criarConta({
      nome: 'Casa do Pão', email: 'ong2@teste.com', senha: 'segredo123', papel: 'ong'
    });

    await request(app).post(`/api/doacoes/${id}/reservar`)
      .set('Authorization', `Bearer ${primeira}`);
    const res = await request(app).post(`/api/doacoes/${id}/reservar`)
      .set('Authorization', `Bearer ${segunda}`);
    expect(res.status).toBe(409);
  });

  it('bloqueia restaurante tentando reservar', async () => {
    const id = await publicarDoacao();
    const restaurante = await criarConta({
      nome: 'Bistrô', email: 'bistro@teste.com', senha: 'segredo123', papel: 'restaurante'
    });
    const res = await request(app).post(`/api/doacoes/${id}/reservar`)
      .set('Authorization', `Bearer ${restaurante}`);
    expect(res.status).toBe(403);
  });

  it('devolve 404 para doação inexistente', async () => {
    const ong = await contaOng();
    const res = await request(app).post('/api/doacoes/999/reservar')
      .set('Authorization', `Bearer ${ong}`);
    expect(res.status).toBe(404);
  });
});
