// Teste de ponta a ponta do MVP: cadastro -> doação -> reserva.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar } from '../src/db.js';

const app = criarApp();

beforeEach(async () => { await migrar(); await limparBanco(); });
afterAll(async () => { await encerrar(); });

describe('fluxo completo do MVP', () => {
  it('restaurante se cadastra, publica, ONG se cadastra e reserva', async () => {
    // 1. Restaurante cria conta
    const restaurante = await request(app).post('/api/cadastro').send({
      nome: 'Cantina da Praça', email: 'cantina@teste.com', senha: 'segredo123',
      papel: 'restaurante', telefone: '47 99999-0000', endereco: 'Rua das Flores, 10'
    });
    expect(restaurante.status).toBe(201);

    // 2. Restaurante publica a doação
    const doacao = await request(app).post('/api/doacoes')
      .set('Authorization', `Bearer ${restaurante.body.token}`)
      .send({
        tipo: 'Marmitas', quantidade: '20 porções', validade: '2026-12-01',
        retirada: 'hoje, das 18h às 20h', descricao: 'Manter refrigerado'
      });
    expect(doacao.status).toBe(201);

    // 3. ONG cria conta e vê a doação no feed
    const ong = await request(app).post('/api/cadastro').send({
      nome: 'Mãos Amigas', email: 'ong@teste.com', senha: 'segredo123', papel: 'ong'
    });
    const feed = await request(app).get('/api/doacoes')
      .set('Authorization', `Bearer ${ong.body.token}`);
    expect(feed.body).toHaveLength(1);
    expect(feed.body[0].restaurante_endereco).toBe('Rua das Flores, 10');

    // 4. ONG reserva
    const reserva = await request(app).post(`/api/doacoes/${doacao.body.id}/reservar`)
      .set('Authorization', `Bearer ${ong.body.token}`);
    expect(reserva.status).toBe(200);
    expect(reserva.body.status).toBe('reservada');

    // 5. O restaurante enxerga quem reservou
    const minhas = await request(app).get('/api/doacoes/minhas')
      .set('Authorization', `Bearer ${restaurante.body.token}`);
    expect(minhas.body[0].status).toBe('reservada');
    expect(minhas.body[0].ong_nome).toBe('Mãos Amigas');

    // 6. E a doação não aparece mais para outra ONG
    const outraOng = await request(app).post('/api/cadastro').send({
      nome: 'Casa do Pão', email: 'ong2@teste.com', senha: 'segredo123', papel: 'ong'
    });
    const feed2 = await request(app).get('/api/doacoes')
      .set('Authorization', `Bearer ${outraOng.body.token}`);
    expect(feed2.body).toHaveLength(0);
  });

  it('a sessão termina no logout', async () => {
    const conta = await request(app).post('/api/cadastro').send({
      nome: 'Mãos Amigas', email: 'ong@teste.com', senha: 'segredo123', papel: 'ong'
    });
    await request(app).post('/api/logout').set('Authorization', `Bearer ${conta.body.token}`);
    const res = await request(app).get('/api/eu')
      .set('Authorization', `Bearer ${conta.body.token}`);
    expect(res.status).toBe(401);
  });
});
