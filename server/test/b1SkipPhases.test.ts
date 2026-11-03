// Б1: пропуск фаз хода (Предвидение - skip draw, Нянярог - skip play, Носорогорог - goto_end_turn).
// Тесты идут через сервисные входы gameService (playCard, drawCard, performPlayNow, endTurn)
// и через resolveActions для действия goto_end_turn. Игра кладётся в gameStore напрямую.
// Фикстура взята из server/_be_b1_svc_probe.js (Бэкенд, 16/16 PASS).

import * as gs from '../src/gameService';
import * as store from '../src/gameStore';
import { EventBus } from '../src/engine/events';
import { resolveActions } from '../src/engine/executor';
import request from 'supertest';
import app from '../src/testApp';

function mkEntry(skippedPhases: string[]) {
  const state: any = {
    players: [
      { id: 'p1', deck: ['d1', 'd2'], hand: ['c1', 'c2'], discard: [], stable: [], nursery: [], field: [], action_points: 1 },
      { id: 'p2', deck: ['d3'], hand: [], discard: [], stable: [], nursery: [], field: [], action_points: 1 },
    ],
    turn: { currentPlayerId: 'p1', phase: 'begin_turn', skippedPhases },
    cards: {
      c1: { id: 'c1', name: 'Predskazanie', type: 'upgrade', effects: [] },
      c2: { id: 'c2', name: 'Prostaya', type: 'upgrade', effects: [] },
      d1: { id: 'd1', name: 'D1', type: 'basic_unicorn', effects: [] },
      d2: { id: 'd2', name: 'D2', type: 'basic_unicorn', effects: [] },
      d3: { id: 'd3', name: 'D3', type: 'basic_unicorn', effects: [] },
    },
    deck: ['d1', 'd2'],
    discard: [],
  };
  return { state, bus: new EventBus(), logs: [] as any[], pending: null, pendingTimeout: null } as any;
}

describe('Б1: пропуск фазы добора (skip=draw)', () => {
  beforeEach(() => store.games.clear());

  it('drawCard при skip=draw: ok, карта не добрана, колода не тронута, фаза action', async () => {
    const entry = mkEntry(['draw']);
    store.games.set('b1d1', entry);
    const handBefore = entry.state.players[0].hand.slice();
    const deckBefore = entry.state.deck.slice();
    const r: any = await gs.drawCard('b1d1', 'p1', { via: 'rest' });
    expect(r.ok).toBe(true);
    expect(entry.state.players[0].hand).toEqual(handBefore);
    expect(entry.state.deck).toEqual(deckBefore);
    expect(entry.state.turn.phase).toBe('action');
  });

  it('drawCard при skip=draw пишет лог phase_skipped (фаза draw)', async () => {
    const entry = mkEntry(['draw']);
    store.games.set('b1d2', entry);
    await gs.drawCard('b1d2', 'p1', { via: 'rest' });
    const logs = entry.logs.filter((l: any) => l.details && l.details.event === 'phase_skipped');
    expect(logs).toHaveLength(1);
    expect(logs[0].details.phase).toBe('draw');
  });

  it('контроль: drawCard без пропуска добирает карту и лога phase_skipped нет', async () => {
    const entry = mkEntry([]);
    store.games.set('b1d3', entry);
    const r: any = await gs.drawCard('b1d3', 'p1', { via: 'rest' });
    expect(r.ok).toBe(true);
    expect(entry.state.players[0].hand).toHaveLength(3);
    expect(entry.logs.filter((l: any) => l.details && l.details.event === 'phase_skipped')).toHaveLength(0);
  });
});

describe('Б1: пропуск фазы розыгрыша (skip=play)', () => {
  beforeEach(() => store.games.clear());

  it('playCard при skip=play: BAD_REQUEST, рука и очко действия не тронуты', async () => {
    const entry = mkEntry(['play']);
    entry.state.turn.phase = 'action';
    store.games.set('b1p1', entry);
    const r: any = await gs.playCard('b1p1', 'p1', 'c1', {});
    expect(r.ok).toBe(false);
    expect(r.code).toBe('BAD_REQUEST');
    expect(r.message).toMatch(/этом ходу/);
    expect(entry.state.players[0].hand).toEqual(['c1', 'c2']);
    expect(entry.state.players[0].action_points).toBe(1);
  });

  it('performPlayNow при skip=play: отказ, карта остаётся в руке (обход окна закрыт)', async () => {
    const entry = mkEntry(['play']);
    entry.state.turn.phase = 'action';
    store.games.set('b1p2', entry);
    const player = entry.state.players[0];
    const r: any = await gs.performPlayNow(entry, player, 'b1p2', 'c1');
    expect(r.ok).toBe(false);
    expect(player.hand).toEqual(['c1', 'c2']);
  });

  it('контроль: playCard без пропуска разыгрывает карту', async () => {
    const entry = mkEntry([]);
    entry.state.turn.phase = 'action';
    store.games.set('b1p3', entry);
    const r: any = await gs.playCard('b1p3', 'p1', 'c1', {});
    expect(r.code).not.toBe('BAD_REQUEST');
    expect(entry.state.players[0].hand).not.toContain('c1');
  });
});

describe('Б1: сброс пропусков при передаче хода', () => {
  beforeEach(() => store.games.clear());

  it('endTurn очищает skippedPhases и передаёт ход следующему игроку', async () => {
    const entry = mkEntry(['draw', 'play']);
    entry.state.turn.phase = 'end_turn';
    store.games.set('b1e1', entry);
    await gs.endTurn('b1e1');
    expect(entry.state.turn.skippedPhases).toEqual([]);
    expect(entry.state.turn.currentPlayerId).toBe('p2');
  });
});

describe('Б1: действие goto_end_turn (Носорогорог)', () => {
  it('заполняет пропуски draw/play/action, ставит phase end_turn и НЕ передаёт ход', async () => {
    const entry = mkEntry([]);
    entry.state.turn.phase = 'action';
    const ctx: any = { state: entry.state, bus: new EventBus(), logs: entry.logs, pending: null };
    const ok = await resolveActions(ctx, entry.state.players[0], [{ kind: 'goto_end_turn' } as any]);
    expect(ok).toBe(true);
    expect(entry.state.turn.skippedPhases).toEqual(expect.arrayContaining(['draw', 'play', 'action']));
    expect(entry.state.turn.phase).toBe('end_turn');
    expect(entry.state.turn.currentPlayerId).toBe('p1');
  });
});

describe('Б1: роутовые входы соблюдают skip=play (routes/game.ts)', () => {
  // Роутовые entrance-точки: playWithTargets (L694-697) и playWithWindow (L1021-1024).
  // Карта в руке, очко действия 1, фаза action — любые 400 кроме «этом ходу» означают,
  // что страж файла не сработал (для контроля взят пропуск draw вместо play).
  const cards = {
    c1: { id: 'c1', name: 'Prostaya', type: 'upgrade', effects: [] },
    c2: { id: 'c2', name: 'Prostaya2', type: 'upgrade', effects: [] },
  };

  async function seedRoute(skippedPhases: string[], hand: string[]): Promise<string> {
    const state = {
      players: [
        { id: 'p1', deck: [], hand: hand.slice(), discard: [], stable: [], nursery: [], field: [], action_points: 1 },
        { id: 'p2', deck: [], hand: [], discard: [], stable: [], nursery: [], field: [], action_points: 1 },
      ],
      turn: { currentPlayerId: 'p1', phase: 'action', skippedPhases },
      cards,
      deck: [],
      discard: [],
    };
    const res = await request(app).post('/api/game/test/create').send({ state });
    expect(res.status).toBe(200);
    return res.body.id as string;
  }

  async function readRoute(id: string): Promise<any> {
    const res = await request(app).get(`/api/game/test/state/${id}`);
    expect(res.status).toBe(200);
    return res.body;
  }

  it('playWithTargets при skip=play: 400, карта в руке, очко не списано, pending не создан', async () => {
    const id = await seedRoute(['play'], ['c1', 'c2']);
    const res = await request(app).post(`/api/game/${id}/playWithTargets`).send({ cardId: 'c1', targets: [] });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/этом ходу/);
    const after = await readRoute(id);
    expect(after.state.players[0].hand).toEqual(['c1', 'c2']);
    expect(after.state.players[0].action_points).toBe(1);
    expect(after.state.players[0].stable).toEqual([]);
    expect(after.pending).toBeNull();
    expect(after.logs).toHaveLength(0);
  });

  it('playWithWindow при skip=play: 400, карта в руке, очко не списано, pending не создан', async () => {
    const id = await seedRoute(['play'], ['c1', 'c2']);
    const res = await request(app).post(`/api/game/${id}/playWithWindow`).send({ cardId: 'c1' });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/этом ходу/);
    const after = await readRoute(id);
    expect(after.state.players[0].hand).toEqual(['c1', 'c2']);
    expect(after.state.players[0].action_points).toBe(1);
    expect(after.pending).toBeNull();
    expect(after.logs).toHaveLength(0);
  });

  it('контроль: playWithTargets с пропуском draw страж не срабатывает (доходит до проверки руки)', async () => {
    const id = await seedRoute(['draw'], ['c1', 'c2']);
    const res = await request(app).post(`/api/game/${id}/playWithTargets`).send({ cardId: 'zzz', targets: [] });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).not.toMatch(/этом ходу/);
    expect(String(res.body.message)).toMatch(/Card not in hand/);
  });

  it('контроль: playWithWindow с пропуском draw страж не срабатывает (доходит до проверки руки)', async () => {
    const id = await seedRoute(['draw'], ['c1', 'c2']);
    const res = await request(app).post(`/api/game/${id}/playWithWindow`).send({ cardId: 'zzz' });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).not.toMatch(/этом ходу/);
    expect(String(res.body.message)).toMatch(/Card not in hand/);
  });
});
