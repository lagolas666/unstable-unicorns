/** Вычисляет лимит руки по текущим картам в стойлах. */
import { HAND_LIMIT_BASE } from '../game/config';

export function handLimitFor(state: any, player: any): number {
  let delta = 0;
  const stable: string[] = Array.isArray(player?.stable) ? player.stable : [];
  for (const cid of stable) {
    const c = state?.cards ? state.cards[cid] : undefined;
    if (!c) continue;
    const d = Number(c?.hand_limit_delta || 0);
    if (!Number.isNaN(d)) delta += d;
  }

  let limit = Math.max(0, HAND_LIMIT_BASE + delta);
  // Постоянный эффект вычисляется по текущим стойлам, а не сохраняется после ухода источника.
  for (const owner of Array.isArray(state?.players) ? state.players : []) {
    for (const cid of Array.isArray(owner.stable) ? owner.stable : []) {
      const effects = state?.cards?.[cid]?.effects;
      for (const effect of Array.isArray(effects) ? effects : []) {
        if (effect.trigger !== 'while_in_stable' || effect.condition || effect.optional || effect.while_source_in && effect.while_source_in !== 'stable') continue;
        for (const action of Array.isArray(effect.actions) ? effect.actions : []) {
          if (action.kind !== 'modify_hand_limit') continue;
          const applies = action.target_player === 'all' || action.target_player === 'any'
            || action.target_player === 'self' && owner.id === player.id
            || action.target_player === 'opponent' && owner.id !== player.id;
          if (!applies) continue;
          const match = typeof action.modifier === 'string' ? /^set_to_(\d+)$/.exec(action.modifier) : null;
          if (match) limit = Number(match[1]);
        }
      }
    }
  }
  return limit;
}
