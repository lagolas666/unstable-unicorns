// Массовые триггеры: while_in_stable и on_turn_end (задача В7-1-1, Аналитик 11.11.2026).
//
// СОСТОЯНИЕ КОДА НА МОМЕНТ НАПИСАНИЯ (проверено по файлам, не по отчётам):
//   * 'while_in_stable' — 0 вхождений в server/src/** и 0 в routes/game.ts.
//     В каталоге v2 этот триггер стоит у 24 карт. Диспетчера нет -> эффекты не исполняются.
//   * 'on_turn_end' — исполняется ВРУЧНУЮ в gameService.endTurn (L921-931), не в executor.
//     В каталоге v2 таких карт 2 (Единорожье лассо, Самый рогатый единорог).
//   * action.kind 'prevent', 'reactive_trigger', 'restrict_action', 'modify_hand_limit'
//     не имеют веток в executeAction (в отличие от 'set_flag' и 'modify_win_condition').
//
// ПОЧЕМУ ЭТИ ТЕСТЫ КРАСНЫЕ: движок не читает эффекты с trigger='while_in_stable' ни на
// старте хода (triggerTurnStartEffects берёт только on_turn_start), ни где-либо ещё.
// ЗЕЛЁНЫМИ они станут только после реализации диспетчера в executor.ts/gameService.ts.
//
// НЕВАКУМНОСТЬ: W3b, W4, W5 — контрольные. Они зелёные сегодня и обязаны остаться зелёными:
// они ловят другую ошибку — если диспетчер начнёт исполнять непрерывные эффекты у карт,
// которых нет в стойле (W4), или проигнорирует условие (W3b).
//
// Фикстуры, где возможно, берут карту из server/data/catalog.v2.json целиком: имя русское,
// поэтому успех достижим только через данные, а не через сравнение по английскому имени.

import * as fs from 'fs';
import * as path from 'path';
import { games } from '../src/gameStore';
import { createGame, turnStart } from './helpers/api';
import request from 'supertest';
import app from '../src/testApp';

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'catalog.v2.json');
const rawCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const CATALOG: any[] = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.cards || rawCatalog.data || [];
const CATALOG_BY_ID = new Map<string, any>(CATALOG.map((c) => [String(c.id), c]));

/** Копия карты из каталога v2 — единственный источник id/name/type/effects. */
function fromCatalog(catalogId: string): any {
  const src = CATALOG_BY_ID.get(catalogId);
  if (!src) throw new Error('карты нет в catalog.v2.json: ' + catalogId);
  return JSON.parse(JSON.stringify(src));
}

function filler(id: string): any {
  return { id, type: 'basic_unicorn', name: id, effects: [] };
}

function baseState(over: any = {}) {
  const mkPlayer = (id: string, extra: any = {}) => ({
    id,
    deck: [],
    hand: [],
    discard: [],
    stable: [],
    nursery: [],
    field: [],
    action_points: 1,
    ...extra,
  });
  return {
    players: [mkPlayer('p1'), mkPlayer('p2')],
    cards: {} as Record<string, any>,
    // Непустая колода: иначе фоллбек «колода И сброс пусты» объявляет партию оконченной.
    deck: ['z1', 'z2'] as string[],
    discard: [] as string[],
    turn: { currentPlayerId: 'p1', phase: 'begin_turn', has_drawn: false },
    ...over,
  } as any;
}

/** Наполнители колоды обязаны лежать в state.cards, иначе добор их не найдёт. */
function withDeck(state: any) {
  state.cards = state.cards || {};
  for (const id of state.deck) if (!state.cards[id]) state.cards[id] = filler(id);
  return state;
}

afterEach(() => {
  for (const [, ent] of games as any) {
    if (ent && ent.pendingTimeout) {
      clearTimeout(ent.pendingTimeout);
      ent.pendingTimeout = null;
    }
  }
  (games as any).clear();
  jest.useRealTimers();
});

describe('while_in_stable: непрерывные эффекты из данных каталога', () => {
  it('W1 диспетчер исполняет while_in_stable на старте хода владельца (draw 1)', async () => {
    const state = withDeck(baseState());
    // Карты с while_in_stable+draw в каталоге v2 нет: проверяем именно диспетчер,
    // а не конкретную карту, поэтому фикстура задаёт действие вручную.
    state.cards.ws_draw = {
      id: 'ws_draw',
      type: 'upgrade',
      name: 'Полоса награды',
      effects: [
        { trigger: 'while_in_stable', actions: [{ kind: 'draw', target_player: 'self', target: { quantity: { value: 1 } } }] },
      ],
    };
    state.players[0].stable = ['ws_draw'];
    const id = await createGame(state);

    const res = await turnStart(id);
    expect(res.status).toBe(200);
    const s = res.body.state;
    // Невакуумность: без диспетчера рука остаётся пустой (сейчас именно так -> RED).
    expect(s.players[0].hand).toHaveLength(1);
    expect(s.deck.length).toBe(1);
  });

  it('W2 реальная карта Видеоняня: while_in_stable set_flag reveal_hand владельцу', async () => {
    const state = withDeck(baseState());
    const card = fromCatalog('baby_monitor_downgrade');
    // Страховка от регрессии фикстуры: имя русское, английского токена нет.
    expect(String(card.name).toLowerCase()).not.toContain('baby_monitor');
    state.cards[card.id] = card;
    state.players[0].stable = [card.id];
    const id = await createGame(state);

    const res = await turnStart(id);
    expect(res.status).toBe(200);
    const s = res.body.state;
    // set_flag пишет в три адреса (executor.ts L1712): карта, игрок, state.
    // Ни один не заполнен, пока диспетчера нет -> RED.
    expect(s.players[0].flags?.reveal_hand).toBe(true);
  });

  it('W3a условие эффекта: Похищение единорогов без своих единорогов жертвует себя', async () => {
    const state = withDeck(baseState());
    const card = fromCatalog('unicorn_kidnapping_downgrade');
    const ws = (card.effects || []).find((e: any) => e && e.trigger === 'while_in_stable');
    // Инвариант фикстуры: у эффекта есть condition count_in_zone == 0.
    expect(ws?.condition?.rules?.length).toBeGreaterThan(0);
    state.cards[card.id] = card;
    state.players[0].stable = [card.id]; // в стойле 0 единорогов -> условие истинно
    const id = await createGame(state);

    const res = await turnStart(id);
    expect(res.status).toBe(200);
    const s = res.body.state;
    // Условие истинно: карта должна пожертвовать себя и уйти в сброс.
    expect(s.players[0].discard).toContain(card.id);
    expect(s.players[0].stable).not.toContain(card.id);
  });

  it('W3b КОНТРОЛЬ: при одном единороге в стойле то же условие ложно — карта остаётся', async () => {
    const state = withDeck(baseState());
    const card = fromCatalog('unicorn_kidnapping_downgrade');
    state.cards[card.id] = card;
    state.cards.u1 = filler('u1');
    state.cards.u2 = filler('u2');
    state.players[0].stable = [card.id, 'u1', 'u2']; // состояние сломано? нет: единорог есть
    const id = await createGame(state);

    const res = await turnStart(id);
    expect(res.status).toBe(200);
    const s = res.body.state;
    // Ловит диспетчер, который жжёт непрерывные эффекты без чтения condition.
    expect(s.players[0].stable).toContain(card.id);
    expect(s.players[0].discard).not.toContain(card.id);
  });

  it('W4 КОНТРОЛЬ: while_in_stable не работает у карты в руке или сбросе', async () => {
    const state = withDeck(baseState());
    const card = fromCatalog('baby_monitor_downgrade');
    state.cards[card.id] = card;
    state.players[0].hand = [card.id];
    state.players[0].discard = [fromCatalog('pandamonium_downgrade').id];
    state.cards[state.players[0].discard[0]] = fromCatalog('pandamonium_downgrade');
    const id = await createGame(state);

    const res = await turnStart(id);
    expect(res.status).toBe(200);
    const s = res.body.state;
    expect(s.players[0].flags?.reveal_hand).toBeUndefined();
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('W5 инвариант каталога: while_in_stable ровно у 24 карт', () => {
    const hits = CATALOG.filter((c) =>
      (c.effects || []).some((e: any) => e && e.trigger === 'while_in_stable')
    );
    expect(hits).toHaveLength(24);
    // Список для реализации диспетчера: ни одно kind ниже не имеет ветки в executeAction
    // кроме set_flag / modify_win_condition.
    const kinds = new Set<string>();
    for (const c of hits) {
      for (const e of c.effects || []) {
        if (e?.trigger !== 'while_in_stable') continue;
        for (const a of e.actions || []) kinds.add(String(a.kind));
      }
    }
    expect([...kinds].sort()).toEqual([
      'modify_action',
      'modify_hand_limit',
      'modify_win_condition',
      'prevent',
      'reactive_trigger',
      'restrict_action',
      'sacrifice',
      'set_flag',
    ]);
  });
});

describe('on_turn_end: эффекты конца хода (наблюдение по факту кода)', () => {
  it('O1 on_turn_end draw 1 исполняется при /endTurn', async () => {
    const state = withDeck(baseState({ turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: true } }));
    state.cards.oe_draw = {
      id: 'oe_draw',
      type: 'upgrade',
      name: 'Закатный горн',
      effects: [
        { trigger: 'on_turn_end', actions: [{ kind: 'draw', target_player: 'self', target: { quantity: { value: 1 } } }] },
      ],
    };
    state.players[0].stable = ['oe_draw'];
    const id = await createGame(state);

    const res = await request(app).post(`/api/game/${id}/endTurn`).send();
    expect(res.status).toBe(200);
    // Тело /endTurn — это сам GameState (не {state}), проверено пробником.
    const s = res.body;
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('O2 инвариант каталога: on_turn_end у 2 карт', () => {
    const hits = CATALOG.filter((c) =>
      (c.effects || []).some((e: any) => e && e.trigger === 'on_turn_end')
    );
    expect(hits.map((c) => String(c.id)).sort()).toEqual(['horniest_unicorn_magic', 'unicorn_lasso_upgrade']);
  });
});
