import { games } from '../src/gameStore';
import { playCard, performPlayNow } from '../src/gameService';
import { EventBus } from '../src/engine/events';

// Зона Тестировщика: server/test/**.
// Проверяется ветка executeAction -> case 'sacrifice' (executor.ts L1093-1151):
// кто владелец карт, которые жертвуются. Цель НЕ передаётся извне, работает автопрохождение.
//
// Форма действия взята из data/catalog.v2.json (поле `target`; нормализация .target -> .targets
// живёт в normalizeActionTargets, L694/L952):
//   md 26 Sadistic Unicorn  sacrifice qty 1   group unicorn    scope any
//   md 36 Reset Button      sacrifice qty 99  group upgrade    scope any
//   md 71 Rescue Unicorn    sacrifice qty 99  group downgrade  scope any
// Все три в каталоге со scope:'any' + target_player:'all', текст правил — «каждый игрок».
//
// ВАЖНО: разыгрываем через performPlayNow, а не через playCard. playCard L583-585 для
// sacrifice в on_play требует явную цель и отдаёт 409 — это отдельный слой (выбор цели),
// он не про владельцев и закрыл бы проверяемое правило. Отмечаю как смежную находку.
//
// Критерий приёмки (мутация): executor.ts L1100 `const owners = [player];` -> всех игроков.
//   Обязаны покраснеть ровно S2, S3, S4. Контроль S1 (scope:'self') остаётся зелёным.

function mkPlayer(id: string, extra: any = {}) {
  return { id, deck: [], hand: [], discard: [], stable: [], nursery: [], field: [], action_points: 1, ...extra };
}

function uni(id: string) {
  return { id, name: 'Uni ' + id, type: 'basic_unicorn', effects: [] };
}
function upg(id: string, kind: 'upgrade' | 'downgrade') {
  return { id, name: kind + ' ' + id, type: kind, effects: [] };
}

const SAC_SELF = 'SAC_SELF';
const SAC_Q1_UNI = 'SAC_Q1_UNI';
const SAC_Q99_UPG = 'SAC_Q99_UPG';
const SAC_Q99_DWN = 'SAC_Q99_DWN';

function sacrificeCard(id: string, opts: { scope: 'self' | 'any'; qty: number; group: any }) {
  return {
    id,
    name: 'Sacrifice ' + opts.scope,
    type: 'magic',
    play_requirements: {},
    effects: [
      {
        trigger: 'on_play',
        actions: [
          {
            kind: 'sacrifice',
            target_player: 'all',
            target: {
              scope: opts.scope,
              zone: 'stable',
              filters: { card_group: opts.group },
              quantity: { value: opts.qty },
            },
          },
        ],
      },
    ],
  };
}

function mkState() {
  return {
    players: [
      mkPlayer('p1', { hand: [SAC_SELF, SAC_Q1_UNI, SAC_Q99_UPG, SAC_Q99_DWN], stable: ['u1', 'u2', 'p1up', 'p1dn'] }),
      mkPlayer('p2', { stable: ['o1', 'o2', 'p2up', 'p2dn'] }),
    ],
    cards: {
      [SAC_SELF]: sacrificeCard(SAC_SELF, { scope: 'self', qty: 1, group: 'any' }),
      [SAC_Q1_UNI]: sacrificeCard(SAC_Q1_UNI, { scope: 'any', qty: 1, group: 'unicorn' }),
      [SAC_Q99_UPG]: sacrificeCard(SAC_Q99_UPG, { scope: 'any', qty: 99, group: 'upgrade' }),
      [SAC_Q99_DWN]: sacrificeCard(SAC_Q99_DWN, { scope: 'any', qty: 99, group: 'downgrade' }),
      u1: uni('u1'), u2: uni('u2'), o1: uni('o1'), o2: uni('o2'),
      p1up: upg('p1up', 'upgrade'), p2up: upg('p2up', 'upgrade'),
      p1dn: upg('p1dn', 'downgrade'), p2dn: upg('p2dn', 'downgrade'),
      z1: uni('z1'), z2: uni('z2'),
    },
    deck: ['z1', 'z2'],
    discard: [],
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: true },
  } as any;
}

function entryOf(state: any) {
  const id = 'sac-' + Math.random().toString(36).slice(2);
  const entry: any = { state, bus: new EventBus(), logs: [], pending: null };
  games.set(id, entry);
  return { id, entry };
}

afterEach(() => {
  for (const key of Array.from(games.keys())) {
    if (String(key).startsWith('sac-')) games.delete(key as string);
  }
});

async function fire(cardId: string) {
  const state = mkState();
  const { id, entry } = entryOf(state);
  await performPlayNow(entry, entry.state.players[0], id, cardId);
  return entry;
}

describe('sacrifice: владельцы карт (executeAction L1093)', () => {
  // КОНТРОЛЬ: scope:'self' работает и сейчас. При мутации L1100 обязан остаться зелёным.
  it('S1 scope:self — ровно одна своя карта в discard, стойло соперника цело', async () => {
    const state = mkState();
    const { id, entry } = entryOf(state);
    const p2Before = JSON.stringify(entry.state.players[1]);

    await performPlayNow(entry, entry.state.players[0], id, SAC_SELF);

    const p1 = entry.state.players[0];
    const p2 = entry.state.players[1];
    expect(p1.discard.length).toBe(1);
    expect(p1.stable.length).toBe(3);
    expect(JSON.stringify(p2)).toBe(p2Before);
  });

  // Аналог md 26: qty 1, unicorn, «каждый игрок жертвует 1 единорога».
  it('S2 scope:any qty1 unicorn — жертвует каждый игрок, а не только актор', async () => {
    const entry = await fire(SAC_Q1_UNI);
    const p2 = entry.state.players[1];
    expect(p2.discard.length).toBe(1);
    expect(p2.stable.length).toBe(3);
  });

  // Аналог md 36: qty 99, upgrade, «каждый игрок жертвует все БОНУСЫ».
  it('S3 scope:any qty99 upgrade — БОНУСЫ уходят у ВСЕХ игроков', async () => {
    const entry = await fire(SAC_Q99_UPG);
    const p1 = entry.state.players[0];
    const p2 = entry.state.players[1];
    expect(p1.stable).not.toContain('p1up');
    expect(p2.stable).not.toContain('p2up');
    expect(p2.discard).toContain('p2up');
  });

  // Аналог md 71: qty 99, downgrade, «каждый игрок жертвует все ШТРАФЫ».
  it('S4 scope:any qty99 downgrade — ШТРАФЫ уходят у ВСЕХ игроков', async () => {
    const entry = await fire(SAC_Q99_DWN);
    const p1 = entry.state.players[0];
    const p2 = entry.state.players[1];
    expect(p1.stable).not.toContain('p1dn');
    expect(p2.stable).not.toContain('p2dn');
    expect(p2.discard).toContain('p2dn');
  });
});
