import type { ContinuationEnvelope, JsonValue } from '../gameStore';

// Поля ограничены идентификаторами и счётчиками: runtime-контекст не сохраняется.
export type PlayFrame = { kind: 'play'; playerId: string; cardId: string; stage: string; cursor: number };
export type EffectFrame = { kind: 'effect'; actorId: string; sourceId: string; effectIndex: number; cursor: number; succeeded: boolean };
export type ActionFrame = { kind: 'action'; actorId: string; sourceId: string; actionIndex: number; cursor: number };
export type TriggerFrame = { kind: 'trigger'; trigger: string; actorId: string; sourceId: string; effectIndex: number; cursor: number };
// Курсор считает обработанные попытки, remaining — оставшиеся попытки добора.
export type DrawFrame = { kind: 'draw'; actorId: string; cursor: number; remaining: number };
export type Frame = PlayFrame | EffectFrame | ActionFrame | TriggerFrame | DrawFrame;
export type Continuation = { version: 1; frames: Frame[] };

const fields: Record<Frame['kind'], Record<string, 'string' | 'index' | 'boolean'>> = {
  play: { playerId: 'string', cardId: 'string', stage: 'string', cursor: 'index' },
  effect: { actorId: 'string', sourceId: 'string', effectIndex: 'index', cursor: 'index', succeeded: 'boolean' },
  action: { actorId: 'string', sourceId: 'string', actionIndex: 'index', cursor: 'index' },
  trigger: { trigger: 'string', actorId: 'string', sourceId: 'string', effectIndex: 'index', cursor: 'index' },
  draw: { actorId: 'string', cursor: 'index', remaining: 'index' },
};

function isFrame(value: unknown): value is Frame {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const object = value as Record<string, unknown>;
  if (typeof object.kind !== 'string' || !Object.prototype.hasOwnProperty.call(fields, object.kind)) return false;
  const schema = fields[object.kind as Frame['kind']];
  const keys = Object.keys(object);
  if (keys.length !== Object.keys(schema).length + 1 || !keys.every(key => key === 'kind' || Object.prototype.hasOwnProperty.call(schema, key))) return false;
  return Object.entries(schema).every(([key, type]) => {
    const item = object[key];
    return type === 'index' ? typeof item === 'number' && Number.isSafeInteger(item) && item >= 0 : typeof item === type;
  });
}

export type DrawAttempt = { kind: 'attempt'; actorId: string; cursor: number } | { kind: 'complete' };
export type DrawAttemptResult = { kind: 'drawn' | 'cancelled'; frame: DrawFrame };

// Сумма счётчиков постоянна; её переполнение сделало бы дальнейшее продвижение некорректным.
function validateDrawFrame(frame: DrawFrame): void {
  if (!isFrame(frame) || frame.kind !== 'draw' || !Number.isSafeInteger(frame.cursor + frame.remaining)) {
    throw new Error('Invalid draw frame');
  }
}

export function nextDrawAttempt(frame: DrawFrame): DrawAttempt {
  validateDrawFrame(frame);
  return frame.remaining === 0 ? { kind: 'complete' } : { kind: 'attempt', actorId: frame.actorId, cursor: frame.cursor };
}

// Отмена расходует только текущую попытку, а не все оставшиеся доборы.
export function resolveDrawAttempt(frame: DrawFrame, outcome: 'drawn' | 'cancelled'): DrawAttemptResult {
  validateDrawFrame(frame);
  if (frame.remaining === 0 || (outcome !== 'drawn' && outcome !== 'cancelled')) throw new Error('Cannot resolve draw attempt');
  return { kind: outcome, frame: { ...frame, cursor: frame.cursor + 1, remaining: frame.remaining - 1 } };
}

export type PumpResult =
  | { kind: 'blocked'; continuation: Continuation }
  | { kind: 'complete'; continuation: Continuation }
  | { kind: 'step'; continuation: Continuation; frame: Frame };

// Определяет следующий шаг без исполнения обработчиков и изменения стека.
export function pumpStep(continuation: Continuation, guard: { pending: unknown; pendingQueue: readonly unknown[] }): PumpResult {
  if (guard.pending !== null || guard.pendingQueue.length > 0) return { kind: 'blocked', continuation };
  const frame = topFrame(continuation);
  return frame ? { kind: 'step', continuation, frame } : { kind: 'complete', continuation };
}

export function createContinuation(): Continuation { return { version: 1, frames: [] }; }
export function topFrame(stack: Continuation): Frame | undefined { return stack.frames[stack.frames.length - 1]; }
export function popFrame(stack: Continuation): Continuation { return { version: 1, frames: stack.frames.slice(0, -1) }; }

// Корневой кадр добавляется только в пустой стек; дочерний — через advanceAndPush.
export function pushFrame(stack: Continuation, frame: Frame): Continuation {
  if (stack.frames.length !== 0 || !isFrame(frame)) throw new Error('Invalid root frame');
  return { version: 1, frames: [{ ...frame }] };
}

export function advanceTop(stack: Continuation): Continuation {
  const frame = topFrame(stack);
  if (!frame || frame.cursor >= Number.MAX_SAFE_INTEGER) throw new Error('Cannot advance frame');
  return { version: 1, frames: [...stack.frames.slice(0, -1), { ...frame, cursor: frame.cursor + 1 }] };
}

// Атомарно продвигает только верхний родительский кадр до добавления потомка.
export function advanceAndPush(stack: Continuation, child: Frame): Continuation {
  if (!isFrame(child)) throw new Error('Invalid child frame');
  const advanced = advanceTop(stack);
  return { version: 1, frames: [...advanced.frames, { ...child }] };
}

export function toEnvelope(stack: Continuation): ContinuationEnvelope {
  const envelope = { version: 1, frames: stack.frames };
  return parseEnvelope(JSON.stringify(envelope)) as unknown as ContinuationEnvelope;
}

export function parseEnvelope(json: string): Continuation {
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid continuation envelope');
  const envelope = value as Record<string, unknown>;
  if (Object.keys(envelope).length !== 2 || envelope.version !== 1 || !Array.isArray(envelope.frames) || !envelope.frames.every(isFrame)) throw new Error('Invalid continuation envelope');
  return { version: 1, frames: envelope.frames as Frame[] };
}

// Совместимость кадров со storage-контрактом проверяется компилятором отдельно.
const jsonCompatibility: Frame extends JsonValue ? true : false = true;
void jsonCompatibility;
