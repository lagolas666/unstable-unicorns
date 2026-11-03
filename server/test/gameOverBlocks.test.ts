/**
 * D1: после победы партия окончена.
 *
 * Дефект: Даниил довёл партию до 11/7, а play / draw / end_turn продолжали
 * принимать действия — winnerId выставлен, но точки входа его не смотрели.
 * Ожидание: каждое действие отвечает 409 с { gameOver: true }, а состояние
 * не меняется ни на байт (рука, стойло, сброс, колода, фаза, очки действия).
 */
import request from 'supertest';
import app from '../src/testApp';
import { games } from '../src/gameStore';
import { createGame, getState, play } from './helpers/api';
import { unicorn, simpleUpgrade } from './helpers/cards';

function mkClosedState() {
  // Партия уже проиграна: winnerId — защёлка, победил p1 (7 единорогов).
  const unicorns: Record<string, any> = {};
  const p1Stable: string[] = [];
  for (let i = 1; i <= 7; i++) {
    unicorns['w' + i] = unicorn('w' + i, 'Winner ' + i);
    p1Stable.push('w' + i);
  }
  return {
    players: [
      {
        id: 'p1', hand: ['h1'], stable: p1Stable, discard: [], deck: [], nursery: [], field: [],
        action_points: 2,
      },
      {
        id: 'p2', hand: [], stable: ['u1'], discard: [], deck: [], nursery: [], field: [],
        action_points: 1,
      },
    ],
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: true },
    cards: {
      ...unicorns,
      u1: unicorn('u1', 'Loser'),
      h1: simpleUpgrade('h1'),
    },
    deck: ['d1', 'd2'],
    discard: [],
    winnerId: 'p1',
  } as any;
}

// Снимок значимых полей: мутации недопустимы после победы.
function snapshot(st: any) {
  return JSON.stringify({
    winnerId: st.winnerId,
    phase: st.turn.phase,
    has_drawn: st.turn.has_drawn,
    current: st.turn.currentPlayerId,
    deck: st.deck,
    discard: st.discard,
    players: st.players.map((p: any) => ({
      id: p.id,
      hand: p.hand,
      stable: p.stable,
      discard: p.discard,
      action_points: p.action_points,
    })),
  });
}

const closed: string[] = [];

beforeAll(async () => {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
});

afterAll(() => {
  for (const id of closed) games.delete(id);
});

async function makeClosed() {
  const id = await createGame(mkClosedState());
  closed.push(id);
  return id;
}

describe('D1: после победы действия отклоняются', () => {
  it('play: 409 gameOver, карта остаётся в руке, очки действия не тратятся', async () => {
    const id = await makeClosed();
    const before = snapshot(await getState(id));

    const res = await play(id, 'h1');

    expect(res.status).toBe(409);
    expect(res.body.gameOver).toBe(true);
    expect(res.body.winnerId).toBe('p1');
    expect(snapshot(await getState(id))).toBe(before);
  });

  it('draw: 409 gameOver, рука и колода не меняются', async () => {
    const id = await makeClosed();
    const before = snapshot(await getState(id));

    const res = await request(app).post(`/api/game/${id}/draw`).send({});

    expect(res.status).toBe(409);
    expect(res.body.gameOver).toBe(true);
    expect(snapshot(await getState(id))).toBe(before);
  });

  it('endTurn: 409 gameOver, текущий игрок и фаза не меняются', async () => {
    const id = await makeClosed();
    const before = snapshot(await getState(id));

    const res = await request(app).post(`/api/game/${id}/endTurn`).send();

    expect(res.status).toBe(409);
    expect(res.body.gameOver).toBe(true);
    expect(snapshot(await getState(id))).toBe(before);
  });

  it('контроль: партия без winnerId принимает те же действия (guard не мешает)', async () => {
    const state = mkClosedState();
    delete state.winnerId;
    const id = await createGame(state);
    closed.push(id);

    // Добор из begin_turn возможен — здесь фаза action, поэтому проверяем play.
    const res = await play(id, 'h1');
    expect(res.status).toBe(200);
  });
});
