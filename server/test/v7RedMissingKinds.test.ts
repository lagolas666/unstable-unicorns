/**
 * RED-тесты V7-3: while_in_stable-эффекты без потребителя.
 *
 * V7-2 реализовал только `prevent` c prevented_action='play' и `restrict_action`
 * (см. v7Prevent.test.ts / v7Restrict.test.ts). Следующие kind зарегистрированы
 * в updateStableEffects(), но нигде не читаются при разрешении действий:
 *
 *   - prevent с prevented_action='destroy'        (rainbow_aura_upgrade)
 *   - prevent с prevented_action='on_enter_stable'(blinding_light_downgrade, sloth_unicorn_magic)
 *   - reactive_trigger                            (barbed_wire, tiny_stable, unicorn_tax, ...)
 *   - modify_action                               (patient_zero, parallel_universe, scary_pirate)
 *
 * Все тесты ниже должны ПАДАТЬ (RED) ровно по одной функциональной дыре.
 * Когда фича появится — тест обязан позеленеть, ассерции менять не нужно.
 */
import { playCard } from '../src/gameService';
import { games } from '../src/gameStore';
import { createGame, resolvePending, getState } from './helpers/api';
import catalog from '../data/catalog.v2.json';

const card = (id: string): any => {
  const found = (catalog as any[]).find(c => c.id === id);
  if (!found) throw new Error(`catalog.v2.json: card "${id}" not found`);
  return found;
};

const mkPlayer = (id: string): any => ({
  id, deck: [], hand: [], discard: [], stable: [], nursery: [], field: [], action_points: 1,
});

const newGame = (players: any[], extraCards: Record<string, any> = {}, deck: string[] = []): any => {
  const cards: Record<string, any> = { ...extraCards };
  return createGame({
    players,
    cards,
    deck,
    discard: [],
    turn: { currentPlayerId: players[0].id, phase: 'action', has_drawn: true },
  });
};

/** Разрешает открывшееся окно, если оно есть; отсутствие окна — не ошибка. */
const settle = async (id: string) => {
  try { await resolvePending(id); } catch { /* окна не было */ }
  return getState(id);
};

const unicorn = (id: string, name = 'Test Unicorn'): any => ({
  id, type: 'basic_unicorn', name, effects: [],
});

afterEach(() => {
  for (const entry of games.values()) if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
  games.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. prevent / destroy — rainbow_aura_upgrade
//    «Пока эта карта в вашей конюшне ваши карты с Единорогами не могут быть
//     УНИЧТОЖЕНЫ.»
// ─────────────────────────────────────────────────────────────────────────────
test('RED: prevent/destroy — Rainbow Aura спасает единорога от destroy', async () => {
  const aura = card('rainbow_aura_upgrade');           // prevent destroyed_action='destroy'
  const smash = {
    id: 'smash', type: 'magic', name: 'Smash', effects: [{
      trigger: 'on_play',
      actions: [{ kind: 'destroy', targets: { scope: 'opponent', zone: 'stable', filters: { card_group: 'any' }, quantity: { value: 1 } } }],
    }],
  };
  const victim = unicorn('victim', 'Victim');
  const attackerUnicorn = unicorn('atk', 'Attacker');

  const p1 = mkPlayer('p1');
  const p2 = mkPlayer('p2');
  p1.stable = [aura.id, victim.id];
  p2.stable = [attackerUnicorn.id];
  p2.hand = [smash.id];
  p2.action_points = 1;

  const id = await newGame([p2, p1], { [aura.id]: aura, smash, victim, atk: attackerUnicorn });
  // p2 ходит первым (currentPlayerId = p2)
  const r = await playCard(id, 'p2', smash.id, { targets: [victim.id] });
  expect(r.ok).toBe(true);
  const state = await settle(id);

  const p1State = state.players.find((p: any) => p.id === 'p1');
  expect(p1State.stable).toContain(victim.id);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. prevent / on_enter_stable — blinding_light_downgrade
//    «Пока карта в вашей конюшне, эффекты Единорогов на вход в конюшню
//     не срабатывают.»
// ─────────────────────────────────────────────────────────────────────────────
test('RED: prevent/on_enter_stable — Blinding Light гасит immediate-эффект входящего единорога', async () => {
  const blinding = card('blinding_light_downgrade');
  const entering = {
    id: 'entering', type: 'basic_unicorn', name: 'Entering Destroyer', effects: [{
      trigger: 'immediate',
      actions: [{ kind: 'destroy', targets: { scope: 'opponent', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { value: 1 } } }],
    }],
  };
  const target = unicorn('target', 'Target');

  const p1 = mkPlayer('p1');
  const p2 = mkPlayer('p2');
  p1.stable = [blinding.id];
  p1.hand = [entering.id];
  p2.stable = [target.id];

  const id = await newGame([p1, p2], { [blinding.id]: blinding, entering, target });
  const r = await playCard(id, 'p1', entering.id, { targets: [target.id] });
  expect(r.ok).toBe(true);
  const state = await settle(id);

  const p2State = state.players.find((p: any) => p.id === 'p2');
  expect(p2State.stable).toContain(target.id); // эффект на вход должен быть подавлен
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. reactive_trigger / on_enter_stable — barbed_wire_downgrade
//    «Пока карта в вашей конюшне, каждый раз, когда карта Единорог кладется
//     ... в вашу Конюшню, СБРОСЬТЕ 1 карту.»
// ─────────────────────────────────────────────────────────────────────────────
test('RED: reactive_trigger/on_enter_stable — Barbed Wire заставляет сбросить карту', async () => {
  const barbed = card('barbed_wire_downgrade');
  const entering = unicorn('entering', 'Entering');
  const filler1 = unicorn('f1', 'Filler 1');
  const filler2 = unicorn('f2', 'Filler 2');

  const p1 = mkPlayer('p1');
  const p2 = mkPlayer('p2');
  p1.stable = [barbed.id];
  p1.hand = [entering.id, filler1.id, filler2.id];

  const id = await newGame([p1, p2], { [barbed.id]: barbed, entering, f1: filler1, f2: filler2 });
  const r = await playCard(id, 'p1', entering.id);
  expect(r.ok).toBe(true);
  const state = await settle(id);

  const p1State = state.players.find((p: any) => p.id === 'p1');
  // -1 за разыгранную карту, -1 за реакцию Barbed Wire
  expect(p1State.hand).toHaveLength(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. reactive_trigger / on_enter_stable + condition — tiny_stable_downgrade
//    «Пока карта в вашей конюшне, каждый раз, когда у вас появляется больше
//     5 карт с Единорогами в Конюшне, ПОЖЕРТВУЙТЕ 1 карту с Единорогом.»
// ─────────────────────────────────────────────────────────────────────────────
test('RED: reactive_trigger с условием count>5 — Tiny Stable жертвует единорога', async () => {
  const tiny = card('tiny_stable_downgrade');
  const u = (n: string) => unicorn(n, `U${n}`);
  const six = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];

  const p1 = mkPlayer('p1');
  const p2 = mkPlayer('p2');
  p1.stable = [tiny.id, 'u1', 'u2', 'u3', 'u4', 'u5'];
  p1.hand = ['u6'];

  const cards: Record<string, any> = { [tiny.id]: tiny };
  for (const n of six) cards[n] = u(n);

  const id = await newGame([p1, p2], cards);
  const r = await playCard(id, 'p1', 'u6');
  expect(r.ok).toBe(true);
  const state = await settle(id);

  const p1State = state.players.find((p: any) => p.id === 'p1');
  // После входа 6-го единорога (6 > 5) один должен уйти в сброс:
  // остаётся Tiny Stable + 5 единорогов = 6 карт, а не 7.
  expect(p1State.stable).toHaveLength(6);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. modify_action / sacrifice qty — patient_zero_unicorn_magic
//    «Каждый раз, когда любой игрок ЖЕРТВУЕТ карту, вместо этого он должен
//     ПОЖЕРТВОВАТЬ 2 карты.»
// ─────────────────────────────────────────────────────────────────────────────
test('RED: modify_action — Patient Zero удваивает количество жертв', async () => {
  const patientZero = card('patient_zero_unicorn_magic');
  const sacMagic = {
    id: 'sac1', type: 'magic', name: 'Sacrifice 1', effects: [{
      trigger: 'on_play',
      actions: [{ kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { value: 1 } } }],
    }],
  };
  const a = unicorn('a1', 'A1');
  const b = unicorn('a2', 'A2');
  const c = unicorn('a3', 'A3');

  const p1 = mkPlayer('p1');
  const p2 = mkPlayer('p2');
  p1.stable = [patientZero.id];
  p2.stable = [a.id, b.id, c.id];
  p2.hand = [sacMagic.id];
  p2.action_points = 1;

  const id = await newGame([p2, p1], { [patientZero.id]: patientZero, sac1: sacMagic, a1: a, a2: b, a3: c });
  const r = await playCard(id, 'p2', sacMagic.id, { targets: [a.id] });
  expect(r.ok).toBe(true);
  const state = await settle(id);

  const p2State = state.players.find((p: any) => p.id === 'p2');
  // Patient Zero: вместо 1 — 2 жертвы. Остаётся 1 единорог из 3.
  expect(p2State.stable).toHaveLength(1);
});
