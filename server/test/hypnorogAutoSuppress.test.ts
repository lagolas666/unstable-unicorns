import { createGame, getState, turnStart, turnStartChoose } from './helpers/api';
import { geminiUnicorn, hypnorog, simpleUpgrade } from './helpers/cards';

// Гипнорог (Hypnorog) — Магический единорог: блокирует эффекты единорогов соперников.
// Автогашение = карта соперника гасится БЕЗ вызова /react/hypnorog: движок сам находит
// соперника со свойством blocks_unicorn_effects и сбрасывает у него карту из руки.
// Здесь проверяется именно уход карты (hand / discard / action_points), а не текст лога.

type P = {
  id: string;
  hand: string[];
  stable: string[];
  discard: string[];
  deck: string[];
  nursery: string[];
  field: string[];
  action_points: number;
};

function player(id: string, hand: string[], stable: string[]): P {
  return { id, hand, stable, discard: [], deck: [], nursery: [], field: [], action_points: 1 };
}

function buildState(players: P[], cards: Record<string, any>) {
  return {
    players,
    turn: { currentPlayerId: players[0].id, phase: 'begin_turn', has_drawn: false },
    cards,
    // непустая колода: при пустых колоде И сбросе партия сразу окончена фоллбэком
    deck: ['z1', 'z2'],
    discard: [],
  } as any;
}

async function startGeminiTurnAndUse(gameId: string, target: string) {
  let res = await turnStart(gameId);
  expect(res.status).toBe(200);
  expect(res.body.pending?.kind).toBe('prompt');
  res = await turnStartChoose(gameId, { choice: 'use', targets: [target] });
  expect(res.status).toBe(200);
  return getState(gameId);
}

describe('Hypnorog auto-cancel (без вызова react/hypnorog)', () => {
  test('H1: при 3 игроках Гипнорог второго соперника гасит эффект единорога', async () => {
    // A — активный игрок, на входе хода срабатывает Gemini Unicorn (on_turn_start).
    // B — первый соперник в списке, Гипнорога нет, карта в руке есть.
    // C — второй соперник: Гипнорог в стойле и карта в руке, то есть гасить должен именно он.
    const gameId = await createGame(
      buildState(
        [
          player('A', ['a1', 'a2'], ['gem']),
          player('B', ['b1'], []),
          player('C', ['c1'], ['hyp']),
        ],
        {
          gem: geminiUnicorn('gem'),
          hyp: hypnorog('hyp'),
          a1: simpleUpgrade('a1'),
          a2: simpleUpgrade('a2'),
          b1: simpleUpgrade('b1'),
          c1: simpleUpgrade('c1'),
        }
      )
    );

    const state = await startGeminiTurnAndUse(gameId, 'a1');
    const A = state.players.find((p: any) => p.id === 'A');
    const B = state.players.find((p: any) => p.id === 'B');
    const C = state.players.find((p: any) => p.id === 'C');

    // Гасит C: платит картой из руки, карта уходит в его сброс
    expect(C.hand).toEqual([]);
    expect(C.discard).toEqual(['c1']);

    // Эффект A отменён: A не сбрасывает карту и не получает дополнительное действие
    expect(A.hand).toEqual(['a1', 'a2']);
    expect(A.discard).toEqual([]);
    expect(A.action_points).toBe(1);

    // B (соперник без Гипнорога) не участвует в гашении и своих карт не теряет
    expect(B.hand).toEqual(['b1']);
    expect(B.discard).toEqual([]);
  });

  test('H2: без Гипнорога у соперников эффект не гасится (контроль)', async () => {
    // Тот же расклад, но у C в стойле обычная карта без blocks_unicorn_effects.
    // Эффект обязан исполниться: A платит картой из руки и получает +1 действие.
    const gameId = await createGame(
      buildState(
        [
          player('A', ['a1', 'a2'], ['gem']),
          player('B', ['b1'], []),
          player('C', ['c1'], ['plain']),
        ],
        {
          gem: geminiUnicorn('gem'),
          plain: simpleUpgrade('plain'),
          a1: simpleUpgrade('a1'),
          a2: simpleUpgrade('a2'),
          b1: simpleUpgrade('b1'),
          c1: simpleUpgrade('c1'),
        }
      )
    );

    const state = await startGeminiTurnAndUse(gameId, 'a1');
    const A = state.players.find((p: any) => p.id === 'A');
    const C = state.players.find((p: any) => p.id === 'C');

    expect(A.hand).toEqual(['a2']);
    expect(A.discard).toEqual(['a1']);
    expect(A.action_points).toBe(2);

    // Чужие карты в сброс не уходят
    expect(C.hand).toEqual(['c1']);
    expect(C.discard).toEqual([]);
  });

  test('H3: при 2 игроках гашение единственным соперником по-прежнему работает (регресс)', async () => {
    const gameId = await createGame(
      buildState(
        [player('A', ['a1', 'a2'], ['gem']), player('B', ['b1'], ['hyp'])],
        {
          gem: geminiUnicorn('gem'),
          hyp: hypnorog('hyp'),
          a1: simpleUpgrade('a1'),
          a2: simpleUpgrade('a2'),
          b1: simpleUpgrade('b1'),
        }
      )
    );

    const state = await startGeminiTurnAndUse(gameId, 'a1');
    const A = state.players.find((p: any) => p.id === 'A');
    const B = state.players.find((p: any) => p.id === 'B');

    expect(B.hand).toEqual([]);
    expect(B.discard).toEqual(['b1']);
    expect(A.hand).toEqual(['a1', 'a2']);
    expect(A.discard).toEqual([]);
    expect(A.action_points).toBe(1);
  });

  test('H4: тот же расклад на 3 игроков, но Гипнорог у первого соперника — гасит', async () => {
    // Отличие от H1 только порядком игроков: C с Гипнорогом идёт ПЕРВЫМ соперником.
    // H1 красный + H4 зелёный = дефект позиционный (берётся первый соперник), а не «не работает вовсе».
    const gameId = await createGame(
      buildState(
        [
          player('A', ['a1', 'a2'], ['gem']),
          player('C', ['c1'], ['hyp']),
          player('B', ['b1'], []),
        ],
        {
          gem: geminiUnicorn('gem'),
          hyp: hypnorog('hyp'),
          a1: simpleUpgrade('a1'),
          a2: simpleUpgrade('a2'),
          b1: simpleUpgrade('b1'),
          c1: simpleUpgrade('c1'),
        }
      )
    );

    const state = await startGeminiTurnAndUse(gameId, 'a1');
    const A = state.players.find((p: any) => p.id === 'A');
    const B = state.players.find((p: any) => p.id === 'B');
    const C = state.players.find((p: any) => p.id === 'C');

    expect(C.hand).toEqual([]);
    expect(C.discard).toEqual(['c1']);
    expect(A.hand).toEqual(['a1', 'a2']);
    expect(A.discard).toEqual([]);
    expect(A.action_points).toBe(1);
    expect(B.hand).toEqual(['b1']);
    expect(B.discard).toEqual([]);
  });
});
