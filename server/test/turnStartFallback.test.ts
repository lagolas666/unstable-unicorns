// Фолбэки начала хода по имени в triggerTurnStartEffects (executor.ts L165–247) — дефект.
//
// Правило Даниила (05.11.2026): Малыш физически не может быть в руке и не может быть разыгран
// из руки. Законный путь: Ясли → стойло. Поэтому все фикстуры здесь кладут Малыша ТОЛЬКО
// в стойло (как после раздачи из Яслей) — в руке и колоде его нет.
//
// Ожидания:
//   B1 baby_archangel_unicorn (effects: []) в стойле: начало хода НЕ добирает карту. Сейчас краснеет
//      (фолбэк L178 по имени 'archangel'+'unicorn' добавляет карту из колоды в руку).
//   B2 baby_nightmare_unicorn (effects: []) в стойле при единороге в сбросе: стойло и сброс не меняются.
//      Сейчас фолбэк L188 исполняется по имени 'nightmare'+'unicorn'.
//   S1 страж: archangel_unicorn_ultimate в стойле при начале хода НЕ добирает автоматически —
//      его on_turn_start помечен optional:true, эффект уходит в prompts. Зелёный до и после сноса.
//   S2 страж: nightmare_unicorn_ultimate при начале хода не перемещает единорога из сброса
//      автоматически (on_turn_start optional:true) — эффект тоже уходит в prompts.
//
// Разрешено трогать только server/test/**. server/src/** не правим.

import * as fs from 'fs';
import * as path from 'path';
import { triggerTurnStartEffects } from '../src/engine/executor';
import { EventBus } from '../src/engine/events';

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

/** Состояние, где Малыш уже в стойле (законный путь после Яслей), в руке и колоде его нет. */
function mkTurnStartState(babyCard: any, extra: { discard?: string[] } = {}) {
  const state: any = {
    players: [
      { id: 'p1', deck: ['z1', 'z2'], hand: ['h1'], discard: extra.discard ?? [], stable: [babyCard.id], nursery: [], field: [], action_points: 1 },
      { id: 'p2', deck: [], hand: [], discard: [], stable: [], nursery: [], field: [], action_points: 1 },
    ],
    cards: {} as Record<string, any>,
    deck: ['z1', 'z2'],
    discard: extra.discard ?? [],
    turn: { currentPlayerId: 'p1', phase: 'begin_turn', has_drawn: false },
  };
  state.cards[babyCard.id] = babyCard;
  state.cards['h1'] = filler('h1');
  state.cards['z1'] = filler('z1');
  state.cards['z2'] = filler('z2');
  return state;
}

function ctxOf(state: any) {
  return { state, bus: new EventBus() } as any;
}

describe('Фолбэк начала хода по имени (B) и законные стражи ultimate (S)', () => {
  it('B1 Baby Archangel в стойле (effects: []): начало хода НЕ добирает карту из колоды', async () => {
    const baby = fromCatalog('baby_archangel_unicorn');
    expect(baby.effects).toEqual([]);
    const state = mkTurnStartState(baby);
    const handBefore = [...state.players[0].hand];
    const deckBefore = [...state.deck];

    await triggerTurnStartEffects(ctxOf(state), 'p1');

    expect(state.players[0].hand).toEqual(handBefore);
    expect(state.deck).toEqual(deckBefore);
  });

  it('B2 Baby Nightmare в стойле (effects: []) + единорог в сбросе: стойло и сброс не меняются', async () => {
    const baby = fromCatalog('baby_nightmare_unicorn');
    expect(baby.effects).toEqual([]);
    const unicornInDiscard = 'u-discard';
    const state = mkTurnStartState(baby, { discard: [unicornInDiscard] });
    state.cards[unicornInDiscard] = { id: unicornInDiscard, type: 'basic_unicorn', name: 'Единорог из сброса', effects: [] };
    const stableBefore = [...state.players[0].stable];
    const discardBefore = [...state.players[0].discard];

    await triggerTurnStartEffects(ctxOf(state), 'p1');

    expect(state.players[0].stable).toEqual(stableBefore);
    expect(state.players[0].discard).toEqual(discardBefore);
    expect(state.players[0].stable).not.toContain(unicornInDiscard);
  });

  it('S1 страж: Archangel Unicorn ultimate (on_turn_start optional) — не добирает сам, уходит в prompts', async () => {
    const card = fromCatalog('archangel_unicorn_ultimate');
    const state = mkTurnStartState(card);
    const handBefore = [...state.players[0].hand];
    const deckBefore = [...state.deck];

    const prompts = await triggerTurnStartEffects(ctxOf(state), 'p1');

    expect(state.players[0].hand).toEqual(handBefore);
    expect(state.deck).toEqual(deckBefore);
    expect(prompts.some((p) => p.sourceCardId === card.id)).toBe(true);
  });

  it('S2 страж: Nightmare Unicorn ultimate (on_turn_start optional) — не перемещает из сброса сам, уходит в prompts', async () => {
    const card = fromCatalog('nightmare_unicorn_ultimate');
    const unicornInDiscard = 'u-discard';
    const state = mkTurnStartState(card, { discard: [unicornInDiscard] });
    state.cards[unicornInDiscard] = { id: unicornInDiscard, type: 'basic_unicorn', name: 'Единорог из сброса', effects: [] };
    const stableBefore = [...state.players[0].stable];

    const prompts = await triggerTurnStartEffects(ctxOf(state), 'p1');

    expect(state.players[0].stable).toEqual(stableBefore);
    expect(state.players[0].discard).toContain(unicornInDiscard);
    expect(prompts.some((p) => p.sourceCardId === card.id)).toBe(true);
  });
});
