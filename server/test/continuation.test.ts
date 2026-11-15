import {
  advanceAndPush,
  advanceTop,
  createContinuation,
  parseEnvelope,
  popFrame,
  pushFrame,
  toEnvelope,
  topFrame,
} from '../src/engine/continuation';
import type { Frame } from '../src/engine/continuation';

describe('continuation stack helpers', () => {
  const root: Frame = {
    kind: 'play',
    playerId: 'p1',
    cardId: 'card-1',
    stage: 'effects',
    cursor: 0,
  };
  const child: Frame = {
    kind: 'effect',
    actorId: 'p1',
    sourceId: 'card-1',
    effectIndex: 2,
    cursor: 0,
    succeeded: false,
  };

  test('creates an empty stack and pushes a root frame without mutating the source', () => {
    const empty = createContinuation();
    const withRoot = pushFrame(empty, root);

    expect(empty).toEqual({ version: 1, frames: [] });
    expect(topFrame(empty)).toBeUndefined();
    expect(withRoot).toEqual({ version: 1, frames: [root] });
    expect(topFrame(withRoot)).toEqual(root);
  });

  test('advances the top cursor before pushing a child and resumes the parent after pop', () => {
    const withRoot = pushFrame(createContinuation(), root);
    const advanced = advanceTop(withRoot);

    expect(topFrame(advanced)).toEqual({ ...root, cursor: 1 });
    expect(topFrame(withRoot)).toEqual(root);

    const nested = advanceAndPush(withRoot, child);
    expect(nested.frames).toEqual([{ ...root, cursor: 1 }, child]);
    expect(topFrame(nested)).toEqual(child);

    const resumed = popFrame(nested);
    expect(resumed.frames).toEqual([{ ...root, cursor: 1 }]);
    expect(topFrame(resumed)).toEqual({ ...root, cursor: 1 });
    expect(popFrame(resumed)).toEqual(createContinuation());
  });

  test('serializes and restores a stack containing multiple frame kinds', () => {
    const stack = {
      version: 1 as const,
      frames: [
        { ...root, cursor: 3 },
        child,
        { kind: 'draw' as const, actorId: 'p2', cursor: 1, remaining: 2 },
      ],
    };

    const envelope = toEnvelope(stack);
    const restored = parseEnvelope(JSON.stringify(envelope));

    expect(JSON.parse(JSON.stringify(envelope))).toEqual({ version: 1, frames: stack.frames });
    expect(restored).toEqual(stack);
  });
});

describe('continuation envelope validation', () => {
  const validFrame = { kind: 'draw', actorId: 'p1', cursor: 0, remaining: 1 };
  const parse = (value: unknown) => parseEnvelope(JSON.stringify(value));

  test.each([
    ['wrong envelope version', { version: 2, frames: [] }],
    ['an extra envelope field', { version: 1, frames: [], extra: true }],
    ['an unknown frame kind', { version: 1, frames: [{ ...validFrame, kind: 'mystery' }] }],
    ['an extra frame field', { version: 1, frames: [{ ...validFrame, extra: true }] }],
    ['a negative cursor', { version: 1, frames: [{ ...validFrame, cursor: -1 }] }],
    ['a fractional cursor', { version: 1, frames: [{ ...validFrame, cursor: 0.5 }] }],
    ['a negative remaining count', { version: 1, frames: [{ ...validFrame, remaining: -1 }] }],
  ])('rejects %s', (_description, envelope) => {
    expect(() => parse(envelope)).toThrow();
  });

  test('rejects invalid JSON', () => {
    expect(() => parseEnvelope('{')).toThrow();
  });
});
