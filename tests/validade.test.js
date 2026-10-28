// História H1 — Validade da doação: datas inválidas ou passadas são recusadas
// e doações vencidas deixam de aparecer no feed das ONGs.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar, query } from '../src/db.js';
import { hoje } from '../src/doacoes.js';
import * as repo from '../src/repositorio.js';
import { emDias } from './apoio.js';

const app = criarApp();

async function criarConta(dados) {
  const res = await request(app).post('/api/cadastro').send(dados);
  return res.body;
}
const restaurante = () => criarConta({
  nome: 'Cantina da Praça', email: 'cantina@teste.com', senha: 'segredo123', papel: 'restaurante'
});
const ong = () => criarConta({
  nome: 'Mãos Amigas', email: 'ong@teste.com', senha: 'segredo123', papel: 'ong'
});

function publicar(token, validade) {
  return request(app).post('/api/doacoes').set('Authorization', `Bearer ${token}`)
    .send({ tipo: 'Pães', quantidade: '30 unidades', validade });
}

beforeEach(async () => { await migrar(); await limparBanco(); });
afterAll(async () => { await encerrar(); });

describe('H1 — validade ao publicar', () => {
  it('aceita validade para hoje', async () => {
    const { token } = await restaurante();
    const res = await publicar(token, hoje());
    expect(res.status).toBe(201);
    expect(res.body.validade).toBe(hoje());
  });

  it('recusa validade no passado', async () => {
    const { token } = await restaurante();
    const res = await publicar(token, emDias(-1));
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/passado/);
  });

  it('recusa validade fora do formato AAAA-MM-DD', async () => {
    const { token } = await restaurante();
    const res = await publicar(token, '01/12/2026');
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/AAAA-MM-DD/);
  });

  it('recusa data que não existe no calendário', async () => {
    const { token } = await restaurante();
    const res = await publicar(token, '2030-02-30');
    expect(res.status).toBe(400);
  });

  it('não grava nada quando a validade é recusada', async () => {
    const { token } = await restaurante();
    await publicar(token, emDias(-3));
    const { rows } = await query('SELECT COUNT(*) AS total FROM doacoes');
    expect(rows[0].total).toBe(0);
  });
});

describe('H1 — feed sem doações vencidas', () => {
  it('o feed mostra só as doações dentro da validade', async () => {
    const r = await restaurante();
    await publicar(r.token, emDias(2));
    // simula uma doação publicada antes e que venceu ontem
    await repo.inserir({
      restaurante_id: r.usuario.id, tipo: 'Sopa', quantidade: '10 litros', validade: emDias(-1)
    });

    const o = await ong();
    const feed = await request(app).get('/api/doacoes').set('Authorization', `Bearer ${o.token}`);
    expect(feed.status).toBe(200);
    expect(feed.body).toHaveLength(1);
    expect(feed.body[0].tipo).toBe('Pães');
  });

  it('o restaurante continua vendo a doação vencida no próprio painel', async () => {
    const r = await restaurante();
    await repo.inserir({
      restaurante_id: r.usuario.id, tipo: 'Sopa', quantidade: '10 litros', validade: emDias(-1)
    });
    const minhas = await request(app).get('/api/doacoes/minhas')
      .set('Authorization', `Bearer ${r.token}`);
    expect(minhas.body).toHaveLength(1);
  });
});

describe('hoje()', () => {
  it('formata a data local como AAAA-MM-DD', () => {
    expect(hoje(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
