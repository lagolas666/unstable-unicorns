import request from 'supertest';
import app from '../src/testApp';

/**
 * Страж раздачи Nursery (TC-026).
 *
 * Контекст дефекта (закрыт 31.10.2026 в src/routes/game.ts): раздача брала ОДИН babyId
 * через find(type === 'baby_unicorn') и клала его в стойла ВСЕХ игроков. Следствие:
 * один и тот же экземпляр карты висел в нескольких стойлах, а Nursery терял 1 карту вместо N.
 * Гейт из 27 сьютов этот дефект не ловил вообще — отсюда этот файл.
 *
 * Ожидания зафиксированы на боевом каталоге server/data/catalog.v2.json:
 *   329 карт, из них 95 копий baby_unicorn и 234 копии не-baby карт
 *   (по одному экземпляру на карту, deck_count = 1).
 *
 * Разрешено трогать только server/test/**. Если проверка краснеет — это находка в src/**,
 * о ней сообщается как BLOCKED, а не правится здесь.
 */

const BABY_COPIES = 95; // копий baby_unicorn в каталоге
const NON_BABY_COPIES = 234; // копий остальных карт каталога
const STARTING_HAND = 5;

type AnyState = any;

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

function cardTypeOf(state: AnyState, cardId: string): string {
  return String(state.cards?.[cardId]?.type ?? '');
}

function stableBabyEntries(state: AnyState): string[] {
  const out: string[] = [];
  for (const p of state.players) {
    for (const cid of p.stable || []) {
      if (cardTypeOf(state, cid) === 'baby_unicorn') out.push(cid);
    }
  }
  return out;
}

function handBabyEntries(state: AnyState): string[] {
  const out: string[] = [];
  for (const p of state.players) {
    for (const cid of p.hand || []) {
      if (cardTypeOf(state, cid) === 'baby_unicorn') out.push(cid);
    }
  }
  return out;
}

function handTotal(state: AnyState): number {
  return state.players.reduce((sum: number, p: any) => sum + (p.hand || []).length, 0);
}

describe('Nursery deal (TC-026) — 3 players', () => {
  let state: AnyState;
  const players = ['p1', 'p2', 'p3'];

  beforeAll(async () => {
    state = await createGame(players);
  });

  it('N1: у каждого игрока ровно 1 карта в стойле и это baby_unicorn', () => {
    expect(playerIdsOf(state)).toEqual(players);
    for (const p of state.players) {
      const stable: string[] = p.stable || [];
      expect(stable).toHaveLength(1);
      expect(cardTypeOf(state, stable[0])).toBe('baby_unicorn');
      // карта реально существует в словаре, а не висит «пустой строкой»
      expect(state.cards?.[stable[0]]).toBeDefined();
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
    expect(state.nursery).toHaveLength(BABY_COPIES - state.players.length);
  });

  it('N4: в nursery только baby_unicorn, в руках ни одного baby_unicorn', () => {
    for (const cid of state.nursery) {
      expect(cardTypeOf(state, cid)).toBe('baby_unicorn');
    }
    expect(handBabyEntries(state)).toEqual([]);
    for (const p of state.players) {
      expect((p.hand || []).length).toBe(STARTING_HAND);
    }
  });

  it('N5: deck + руки = число не-baby копий каталога', () => {
    expect(Array.isArray(state.deck)).toBe(true);
    for (const cid of state.deck) {
      expect(cardTypeOf(state, cid)).not.toBe('baby_unicorn');
    }
    expect(state.deck.length + handTotal(state)).toBe(NON_BABY_COPIES);
  });

  it('N6: баланс baby-копий — стойла + nursery = все копии каталога', () => {
    // Считаем вхождения, а не уникальные id: прежняя раздача давала 3 вхождения
    // одного id в стойлах при nursery 94, то есть 97 при 95 копиях каталога.
    expect(stableBabyEntries(state).length + state.nursery.length).toBe(BABY_COPIES);
  });
});

describe('Nursery deal (TC-026) — другое число игроков', () => {
  it.each([
    [2, 93],
    [6, 89],
  ])('для %i игроков: стойла уникальны, nursery = %i', async (count, expectedNursery) => {
    const players = Array.from({ length: count }, (_, i) => `p${i + 1}`);
    const state = await createGame(players);

    expect(state.players).toHaveLength(count);

    const stables = state.players.map((p: any) => (p.stable || [])[0]);
    for (const cid of stables) {
      expect(cardTypeOf(state, cid)).toBe('baby_unicorn');
    }
    expect(new Set(stables).size).toBe(count);
    expect(state.nursery).toHaveLength(expectedNursery);
    expect(stableBabyEntries(state).length + state.nursery.length).toBe(BABY_COPIES);
    expect(state.deck.length + handTotal(state)).toBe(NON_BABY_COPIES);
  });
});
