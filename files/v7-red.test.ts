import { handLimitFor } from '../server/src/engine/handLimit';
import { resolveEffect } from '../server/src/engine/executor';
import { EventBus } from '../server/src/engine/events';

test.each([['self', 2, 7], ['opponent', 7, 2], ['all', 2, 2], ['any', 2, 2]])('лимит %s', (target, ownerLimit, otherLimit) => {
  const owner = { id: 'p1', stable: ['source'] };
  const other = { id: 'p2', stable: [] as string[] };
  const state = { players: [owner, other], cards: { source: { effects: [{ trigger: 'while_in_stable', actions: [{ kind: 'modify_hand_limit', target_player: target, modifier: 'set_to_2' }] }] } } };
  expect(handLimitFor(state, owner)).toBe(ownerLimit);
  expect(handLimitFor(state, other)).toBe(otherLimit);
});

test('постоянные действия регистрируются без потери полей и дублей', async () => {
  const player: any = { id: 'p1', deck: [], hand: [], discard: [], stable: ['source'], nursery: [], field: [], action_points: 1 };
  const actions: any[] = [
    { kind: 'reactive_trigger', on_event: 'on_draw', actions: [{ kind: 'discard' }] },
    { kind: 'modify_action', action_type: 'discard', modifier: { multiplier: 2 } },
    { kind: 'modify_hand_limit', target_player: 'all', modifier: 'set_to_2' },
    { kind: 'restrict_action', action_type: 'play_spell', target_player: 'self' },
  ];
  const effect: any = { trigger: 'while_in_stable', actions };
  const state: any = { players: [player], cards: { source: { id: 'source', effects: [effect] } }, turn: { currentPlayerId: 'p1', phase: 'action' } };
  const ctx: any = { state, bus: new EventBus() };
  await resolveEffect(ctx, player, 'source', effect);
  await resolveEffect(ctx, player, 'source', effect);
  expect(player.stableEffects).toHaveLength(4);
  expect(player.stableEffects.map((entry: any) => entry.action)).toEqual(actions);
  expect(new Set(player.stableEffects.map((entry: any) => entry.key)).size).toBe(4);
});
