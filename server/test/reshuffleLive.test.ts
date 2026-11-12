// Решафл сброса через живой REST /play (запрос Бэкенда, #37).
// Карта: md 127 «Единороготопия» (unicornotopia_spell) — on_play: draw_until_limit для self.
// Колода пуста, сброс непуст → движок обязан поднять сброс в колоду и записать
// в журнал партии event:'reshuffle'. Окно pending.kind='play' закрывается через resolvePending.

import request from 'supertest';
import app from '../src/testApp';
import * as store from '../src/gameStore';
import { createGame, resolvePending } from './helpers/api';
import { player, baseTurn, gameState } from './helpers/state';

const SPELL = 'unicornotopia_spell';

// Карта берётся из каталога v2 как есть.
const CARDS: Record<string, any> = {
  [SPELL]: {
    id: SPELL,
    name: 'Единороготопия',
    name_en: 'Unicornotopia',
    type: 'magic',
    effects: [
      {
        trigger: 'on_play',
        actions: [
          { kind: 'draw_until_limit', target_player: 'self' },
          { kind: 'draw', target_player: 'others', optional: true, target: { quantity: { value: 2 } } },
        ],
      },
    ],
  },
};
for (const u of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8']) {
  CARDS[u] = { id: u, name: u, type: 'basic_unicorn', effects: [] };
}

function fixture(deck: string[], discard: string[]): any {
  return gameState({
    players: [player({ id: 'p1', hand: [SPELL] }), player({ id: 'p2' })],
    cards: CARDS,
    turn: baseTurn('p1', 'action', false),
    deck,
    discard,
  });
}

async function playSpell(id: string) {
  const play = await request(app).post(`/api/game/${id}/play`).send({ cardId: SPELL });
  const pendingKind = play.body?.pending?.kind;
  if (pendingKind) await resolvePending(id);
  const entry: any = store.games.get(id);
  return {
    status: play.status,
    pendingKind,
    logs: entry.logs as any[],
    state: entry.state,
    reshuffles: (entry.logs as any[]).filter((l) => l?.details?.event === 'reshuffle'),
  };
}

describe('решафл сброса при доборе через живой REST /play (md 127)', () => {
  beforeEach(() => store.games.clear());

  it('R1: пустая колода + сброс 3 → ровно одна запись event:reshuffle size=3', async () => {
    const id = await createGame(fixture([], ['u1', 'u2', 'u3']));
    const r = await playSpell(id);

    // Фактический журнал печатаем при любом исходе — он нужен в отчёте.
    // eslint-disable-next-line no-console
    console.log('R1 pending=' + r.pendingKind + ' logs=' + JSON.stringify(r.logs.map((l) => [l.type, l.details])));

    expect(r.status).toBe(200);
    expect(r.reshuffles.map((x) => x.details.size)).toEqual([3]);
    // Сыгранная карта-заклинание уходит в общий сброс — это не остаток от добора.
    expect(r.state.discard).toEqual([SPELL]);
    expect(r.state.players[0].hand).toHaveLength(3);
  });

  it('R2: контроль — в колоде 8 карт, добор до лимита 7 не требует решафла', async () => {
    const deck8 = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'];
    const id = await createGame(fixture(deck8, []));
    const r = await playSpell(id);

    // eslint-disable-next-line no-console
    console.log('R2 pending=' + r.pendingKind + ' reshuffles=' + r.reshuffles.length);

    expect(r.status).toBe(200);
    expect(r.reshuffles).toHaveLength(0);
  });
});
