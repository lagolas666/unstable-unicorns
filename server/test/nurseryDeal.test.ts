import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import app from '../src/testApp';

/**
 * Страж раздачи Nursery (TC-026) — новое правило от 05.11.2026.
 *
 * Малыш (Baby Unicorn) определяется ТОЛЬКО признаком данных source_zone === 'nursery_only',
 * а не типом baby_unicorn. Причина: в каталоге 95 карт с типом baby_unicorn, но Малышей
 * среди них 53 — остальные 42 это карты-действия (baby_trap, grow_up, safe_sex, ...),
 * которые обязаны лежать в основной колоде и приходить в руку.
 *
 * Историческая часть (остаётся в силе): прежняя раздача брала ОДИН babyId через
 * find(type === 'baby_unicorn') и клала его в стойла ВСЕХ игроков — один экземпляр висел
 * в нескольких стойлах, а Nursery терял 1 карту вместо N. N2 и N6 стерегут именно это.
 *
 * Числа каталога НЕ хардкодятся вслепую: total/flagged/nonFlagged читаются из
 * server/data/catalog.v2.json, а страж CATALOG_TOTAL/CATALOG_FLAGGED ниже ловит момент,
 * когда каталог поменялся и файл протух молча — именно так он и протух в прошлый раз.
 *
 * Разрешено трогать только server/test/**. Если проверка краснеет — это находка в src/**,
 * о ней сообщается как BLOCKED, а не правится здесь.
 */

const CATALOG_PATH = path.resolve(__dirname, '../data/catalog.v2.json');
const CATALOG_TOTAL = 329; // страж: столько карт в каталоге на момент написания
const CATALOG_FLAGGED = 53; // страж: столько Малышей с флагом source_zone
const NURSERY_FLAG = 'nursery_only';
const STARTING_HAND = 5;

type AnyState = any;

function loadCatalog(): { total: number; flagged: number; nonFlagged: number } {
  const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const cards = Array.isArray(raw) ? raw : raw.cards || raw.all || [];
  const flagged = cards.filter(
    (c: any) => String(c?.source_zone || '') === NURSERY_FLAG,
  ).length;
  return { total: cards.length, flagged, nonFlagged: cards.length - flagged };
}

const CATALOG = loadCatalog();
const FLAGGED_COPIES = CATALOG.flagged; // 53
const NON_FLAGGED_COPIES = CATALOG.nonFlagged; // 276

async function createGame(players: string[]): Promise<AnyState> {
  const res = await request(app)
    .post('/api/game')
    .send({ players: players.map((id) => ({ id })) });
  expect(res.status).toBe(201);
  expect(res.body).toHaveProperty('id');
  expect(res.body).toHaveProperty('state');
  return res.body.state as AnyState;
}

function playerIdsOf(state: AnyState): string[] {
  return state.players.map((p: any) => p.id);
}

function isNurseryCard(state: AnyState, cardId: string): boolean {
  return String(state.cards?.[cardId]?.source_zone || '') === NURSERY_FLAG;
}

function cardTypeOf(state: AnyState, cardId: string): string {
  return String(state.cards?.[cardId]?.type ?? '');
}

function stableNurseryEntries(state: AnyState): string[] {
  const out: string[] = [];
  for (const p of state.players) {
    for (const cid of p.stable || []) {
      if (isNurseryCard(state, cid)) out.push(cid);
    }
  }
  return out;
}

function handNurseryEntries(state: AnyState): string[] {
  const out: string[] = [];
  for (const p of state.players) {
    for (const cid of p.hand || []) {
      if (isNurseryCard(state, cid)) out.push(cid);
    }
  }
  return out;
}

function handTotal(state: AnyState): number {
  return state.players.reduce((sum: number, p: any) => sum + (p.hand || []).length, 0);
}

describe('Каталог — источник чисел для этого файла', () => {
  it('C0: каталог не поменялся под ногами (329 карт, 53 Малыша с флагом)', () => {
    // Если этот ассерт покраснел — изменился КАТАЛОГ, а не движок.
    // Тогда числа ниже надо пересчитать, а не искать регрессию в src/**.
    expect({
      total: CATALOG.total,
      flagged: CATALOG.flagged,
    }).toEqual({ total: CATALOG_TOTAL, flagged: CATALOG_FLAGGED });
    expect(CATALOG.nonFlagged).toBe(CATALOG.total - CATALOG.flagged);
  });
});

describe('Nursery deal (TC-026) — 3 players', () => {
  let state: AnyState;
  const players = ['p1', 'p2', 'p3'];

  beforeAll(async () => {
    state = await createGame(players);
  });

  it('N1: у каждого игрока ровно 1 карта в стойле и это Малыш с флагом source_zone', () => {
    expect(playerIdsOf(state)).toEqual(players);
    for (const p of state.players) {
      const stable: string[] = p.stable || [];
      expect(stable).toHaveLength(1);
      expect(state.cards?.[stable[0]]).toBeDefined();
      // Малыш определяется флагом, а не типом: тип baby_unicorn есть и у 42 действий
      expect({ card: stable[0], flag: isNurseryCard(state, stable[0]) }).toEqual({
        card: stable[0],
        flag: true,
      });
    }
  });

  it('N2: стойла всех игроков РАЗНЫЕ по cardId', () => {
    const stables = state.players.map((p: any) => (p.stable || [])[0]);
    expect(stables.every((c: any) => typeof c === 'string' && c.length > 0)).toBe(true);
    // именно это убивало прежнюю раздачу: один babyId на всех
    expect(new Set(stables).size).toBe(state.players.length);
  });

  it('N3: nursery уменьшился ровно на число игроков', () => {
    expect(Array.isArray(state.nursery)).toBe(true);
    expect(state.nursery).toHaveLength(FLAGGED_COPIES - state.players.length);
  });

  it('N4: в nursery только карты с флагом, в руках ни одной карты с флагом', () => {
    const bad: string[] = [];
    for (const cid of state.nursery) {
      if (!isNurseryCard(state, cid)) bad.push(cid);
    }
    expect(bad).toEqual([]);
    expect(handNurseryEntries(state)).toEqual([]);
    for (const p of state.players) {
      expect((p.hand || []).length).toBe(STARTING_HAND);
    }
  });

  it('N5: deck без карт с флагом; deck + руки = число не-Малыш карт каталога', () => {
    expect(Array.isArray(state.deck)).toBe(true);
    const bad: string[] = [];
    for (const cid of state.deck) {
      if (isNurseryCard(state, cid)) bad.push(cid);
    }
    expect(bad).toEqual([]);
    expect(state.deck.length + handTotal(state)).toBe(NON_FLAGGED_COPIES);
  });

  it('N5b: карты-действия с типом baby_unicorn легально лежат в колоде и руке', () => {
    // 42 карты (baby_trap, black_market_baby_unicorn, grow_up, ...) имеют type baby_unicorn,
    // но Малышами не являются — они обязаны быть доступны из колоды.
    const pool: string[] = (state.deck as string[]).concat(
      ...state.players.map((p: any) => p.hand || []),
    );
    const actionCards = pool.filter(
      (cid: string) => cardTypeOf(state, cid) === 'baby_unicorn' && !isNurseryCard(state, cid),
    );
    expect(actionCards.length).toBeGreaterThan(0);
    for (const cid of actionCards) {
      expect(isNurseryCard(state, cid)).toBe(false);
    }
  });

  it('N6: баланс Малышей — стойла + nursery = все карты с флагом', () => {
    // Считаем вхождения, а не уникальные id: прежняя раздача давала 3 вхождения
    // одного id в стойлах при nursery 50, то есть 53 при 53 копиях каталога.
    expect(stableNurseryEntries(state).length + state.nursery.length).toBe(FLAGGED_COPIES);
  });
});

describe('Nursery deal (TC-026) — другое число игроков', () => {
  it.each([
    [2, 51],
    [6, 47],
  ])('для %i игроков: стойла уникальны, nursery = %i', async (count, expectedNursery) => {
    const players = Array.from({ length: count }, (_, i) => `p${i + 1}`);
    const state = await createGame(players);

    expect(state.players).toHaveLength(count);
    expect(state.nursery).toHaveLength(expectedNursery);
    expect(expectedNursery).toBe(FLAGGED_COPIES - count);

    const stables = state.players.map((p: any) => (p.stable || [])[0]);
    for (const cid of stables) {
      expect(isNurseryCard(state, cid)).toBe(true);
    }
    expect(new Set(stables).size).toBe(count);
    expect(stableNurseryEntries(state).length + state.nursery.length).toBe(FLAGGED_COPIES);
    expect(state.deck.length + handTotal(state)).toBe(NON_FLAGGED_COPIES);
  });
});
