import { handLimitFor } from '../src/engine/handLimit';
import catalog from '../data/catalog.v2.json';

describe('V7-2: постоянный лимит руки из каталога', () => {
  it('применяет лимит ко всем игрокам только пока источник в стойле', () => {
    const card: any = (catalog as any[]).find(c => c.id === 'hunger_unicorn_magic');
    expect(card).toBeDefined();
    const owner = { id: 'p1', stable: [card.id] };
    const other = { id: 'p2', stable: [] as string[] };
    const state = { players: [owner, other], cards: { [card.id]: card } };
    expect(handLimitFor(state, owner)).toBe(2);
    expect(handLimitFor(state, other)).toBe(2);
    owner.stable = [];
    expect(handLimitFor(state, owner)).toBe(7);
    expect(handLimitFor(state, other)).toBe(7);
  });
});
