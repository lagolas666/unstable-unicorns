import request from 'supertest';
import express from 'express';
import gameRouter from '../src/routes/game';

const app = express();
app.use(express.json());
app.use('/api/game', gameRouter);

describe('REST Contract (real engine)', () => {
  let gameId: string;
  let player1Id: string;
  let player2Id: string;

  describe('POST /api/game (create)', () => {
    it('should create game with players:[{id},{id}] and return 201 + {id, state}', async () => {
      player1Id = 'player-1';
      player2Id = 'player-2';
      const res = await request(app)
        .post('/api/game')
        .send({ players: [{ id: player1Id }, { id: player2Id }] });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('state');
      expect(typeof res.body.id).toBe('string');
      expect(res.body.state).toHaveProperty('players');
      expect(Array.isArray(res.body.state.players)).toBe(true);
      gameId = res.body.id;
    });

    it('should reject creation with < 2 players', async () => {
      const res = await request(app)
        .post('/api/game')
        .send({ players: [{ id: 'solo' }] });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/game/:id (read state)', () => {
    it('should return state directly (not wrapped)', async () => {
      const res = await request(app).get(`/api/game/${gameId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('players');
      expect(res.body).toHaveProperty('turn');
      expect(res.body.turn).toHaveProperty('currentPlayerId');
      expect(res.body.turn).toHaveProperty('phase');
      expect(res.body.turn).toHaveProperty('has_drawn');
    });

    it('should have players[].id matching creation', async () => {
      const res = await request(app).get(`/api/game/${gameId}`);
      const playerIds = res.body.players.map((p: any) => p.id);
      expect(playerIds).toContain(player1Id);
      expect(playerIds).toContain(player2Id);
    });

    it('should return 404 for non-existent game', async () => {
      const res = await request(app).get('/api/game/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('Action endpoints (smoke)', () => {
    it('POST /:id/draw should accept request', async () => {
      const res = await request(app)
        .post(`/api/game/${gameId}/draw`)
        .send({ playerId: player1Id });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('POST /:id/endTurn should accept request', async () => {
      const res = await request(app)
        .post(`/api/game/${gameId}/endTurn`)
        .send({ playerId: player1Id });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('POST /:id/playWithTargets should accept request', async () => {
      const res = await request(app)
        .post(`/api/game/${gameId}/playWithTargets`)
        .send({ playerId: player1Id, cardId: 'test-card', targets: {} });
      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('POST /:id/discard should accept request', async () => {
      const res = await request(app)
        .post(`/api/game/${gameId}/discard`)
        .send({ playerId: player1Id, cardId: 'test-card' });
      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('POST /:id/passDraw should accept request', async () => {
      const res = await request(app)
        .post(`/api/game/${gameId}/passDraw`)
        .send({ playerId: player1Id });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('POST /:id/turnStart should accept request', async () => {
      const res = await request(app)
        .post(`/api/game/${gameId}/turnStart`)
        .send({ playerId: player1Id });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('POST /:id/turnStart/choose should accept request', async () => {
      const res = await request(app)
        .post(`/api/game/${gameId}/turnStart/choose`)
        .send({ playerId: player1Id, choices: [] });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('POST /:id/react/neigh should accept request', async () => {
      const res = await request(app)
        .post(`/api/game/${gameId}/react/neigh`)
        .send({ playerId: player1Id, cardId: 'neigh-card' });
      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('POST /:id/react/super_neigh should accept request', async () => {
      const res = await request(app)
        .post(`/api/game/${gameId}/react/super_neigh`)
        .send({ playerId: player1Id, cardId: 'super-neigh-card' });
      expect([200, 201, 400, 404]).toContain(res.status);
    });

    it('POST /:id/react/redirect should accept request', async () => {
      const res = await request(app)
        .post(`/api/game/${gameId}/react/redirect`)
        .send({ playerId: player1Id, targetId: player2Id });
      expect([200, 201, 400, 404]).toContain(res.status);
    });
  });

  describe('Test helpers', () => {
    it('POST /test/create should create test game', async () => {
      const res = await request(app)
        .post('/api/game/test/create')
        .send({ players: 2 });
      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('id');
    });

    it('GET /test/state/:id should return wrapped state', async () => {
      const createRes = await request(app)
        .post('/api/game/test/create')
        .send({ players: 2 });
      const testId = createRes.body.id;
      const res = await request(app).get(`/api/game/test/state/${testId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('state');
      expect(res.body.state).toHaveProperty('players');
    });

    it('POST /test/set/:id should set state', async () => {
      const createRes = await request(app)
        .post('/api/game/test/create')
        .send({ players: 2 });
      const testId = createRes.body.id;
      const stateRes = await request(app).get(`/api/game/test/state/${testId}`);
      const state = stateRes.body.state;
      const res = await request(app)
        .post(`/api/game/test/set/${testId}`)
        .send({ state });
      expect([200, 201]).toContain(res.status);
    });
  });
});
