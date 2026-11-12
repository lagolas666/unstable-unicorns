/**
 * D-2b: тип SocketErrorCode должен принимать код 'nothing_pending', который отдаёт
 * resolvePendingNow (gameService.ts L2252), и сохранять uppercase-коды.
 *
 * RED-механизм: ts-jest диагностирует типы (проверено пробником, TS2322),
 * поэтому несовместимость ловится на этапе компиляции сьюта.
 * Контроль: runtime — продюсер действительно отдаёт nothing_pending, а не
 * только тип его допускает.
 */
import request from 'supertest';
import app from '../src/testApp';
import { games } from '../src/gameStore';
import type { SocketErrorCode } from '../src/socket/handlers';

// Типовой контроль: uppercase-коды остаются допустимыми.
const kept: SocketErrorCode[] = [
  'GAME_NOT_FOUND',
  'BAD_REQUEST',
  'NOT_YOUR_TURN',
  'CARD_NOT_IN_HAND',
  'NO_ACTION_POINTS',
  'WRONG_PHASE',
  'PENDING_ACTION',
];

// RED: 'nothing_pending' не входит в union SocketErrorCode -> TS2322 на этапе компиляции.
const produced: SocketErrorCode = 'nothing_pending';

const uni = (id: string) => ({ id, name: id.toUpperCase(), type: 'basic_unicorn', effects: [] as any[] });

beforeEach(() => {
  games.clear();
});

describe('D-2b: SocketErrorCode vs коды, которые реально отдаёт сервер', () => {
  it('тип принимает nothing_pending и сохраняет uppercase-коды', () => {
    expect(kept.length).toBe(7);
    expect(produced).toBe('nothing_pending');
  });

  it('контроль продюсера: resolvePending без окна отдаёт code nothing_pending', async () => {
    const r0 = await request(app).post('/api/game/test/create').send({
      state: {
        players: [
          { id: 'p1', deck: [], hand: ['h1'], discard: [], stable: [], nursery: [], field: [], action_points: 1 },
          { id: 'p2', deck: [], hand: ['h2'], discard: [], stable: [], nursery: [], field: [], action_points: 1 },
        ],
        cards: { h1: uni('h1'), h2: uni('h2') },
        turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: true },
        deck: [],
        discard: [],
      },
    });
    expect(r0.status).toBe(200);
    const r = await request(app).post(`/api/game/${r0.body.id}/resolvePending`).send({});
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('nothing_pending');
  });
});
