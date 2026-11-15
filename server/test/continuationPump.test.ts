import { pumpStep } from '../src/engine/continuation';
import type { Continuation } from '../src/engine/continuation';

const stack: Continuation = {
  version: 1,
  frames: [
    { kind: 'play', playerId: 'p1', cardId: 'c1', stage: 'effects', cursor: 2 },
    { kind: 'draw', actorId: 'p1', cursor: 0, remaining: 2 },
  ],
};

describe('continuation pump guard', () => {
  test('blocks on pending without mutating the stack', () => {
    const input = structuredClone(stack);
    expect(pumpStep(input, { pending: {}, pendingQueue: [] })).toEqual({ kind: 'blocked', continuation: stack });
    expect(input).toEqual(stack);
  });

  test('blocks on queued pending without mutating the stack', () => {
    const input = structuredClone(stack);
    expect(pumpStep(input, { pending: null, pendingQueue: [{}] })).toEqual({ kind: 'blocked', continuation: stack });
    expect(input).toEqual(stack);
  });

  test('pending takes precedence over an empty stack', () => {
    const empty: Continuation = { version: 1, frames: [] };
    expect(pumpStep(empty, { pending: {}, pendingQueue: [] }).kind).toBe('blocked');
  });

  test('completes when the stack is empty', () => {
    const empty: Continuation = { version: 1, frames: [] };
    expect(pumpStep(empty, { pending: null, pendingQueue: [] })).toEqual({ kind: 'complete', continuation: empty });
  });

  test('describes only the top frame without advancing or mutating any frame', () => {
    const input = structuredClone(stack);
    const result = pumpStep(input, { pending: null, pendingQueue: [] });
    expect(result).toEqual({ kind: 'step', continuation: stack, frame: stack.frames[1] });
    expect(input).toEqual(stack);
  });
});
