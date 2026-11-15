import { nextDrawAttempt, resolveDrawAttempt } from '../src/engine/continuation';
import type { DrawFrame } from '../src/engine/continuation';

const frame: DrawFrame = { kind: 'draw', actorId: 'p1', cursor: 0, remaining: 2 };

describe('pure draw lifecycle', () => {
  test('describes the next attempt without mutation', () => {
    const input = { ...frame };
    expect(nextDrawAttempt(input)).toEqual({ kind: 'attempt', actorId: 'p1', cursor: 0 });
    expect(input).toEqual(frame);
  });

  test('describes completion without an attempt', () => {
    expect(nextDrawAttempt({ ...frame, cursor: 2, remaining: 0 })).toEqual({ kind: 'complete' });
  });

  test('successful attempt advances exactly one unit immutably', () => {
    const input = { ...frame };
    expect(resolveDrawAttempt(input, 'drawn')).toEqual({ kind: 'drawn', frame: { ...frame, cursor: 1, remaining: 1 } });
    expect(input).toEqual(frame);
  });

  test('cancellation consumes only the current draw, leaving subsequent draws', () => {
    expect(resolveDrawAttempt(frame, 'cancelled')).toEqual({ kind: 'cancelled', frame: { ...frame, cursor: 1, remaining: 1 } });
  });

  test('the last resolved attempt leaves a complete frame', () => {
    const result = resolveDrawAttempt({ ...frame, remaining: 1 }, 'drawn');
    expect(nextDrawAttempt(result.frame)).toEqual({ kind: 'complete' });
    expect(() => resolveDrawAttempt(result.frame, 'drawn')).toThrow();
  });

  test.each([
    { cursor: -1, remaining: 1 }, { cursor: 0, remaining: -1 },
    { cursor: 0.5, remaining: 1 }, { cursor: 0, remaining: Infinity },
    { cursor: Number.MAX_SAFE_INTEGER, remaining: 1 },
    { cursor: 1, remaining: Number.MAX_SAFE_INTEGER },
  ])('rejects invalid counters %j', counters => {
    const input = { ...frame, ...counters };
    expect(() => nextDrawAttempt(input)).toThrow();
    expect(() => resolveDrawAttempt(input, 'drawn')).toThrow();
  });
});
