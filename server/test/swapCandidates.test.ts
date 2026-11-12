// swap: кандидаты стороны B — явный выбор соперника и автоподбор обязаны проходить ОДИН фильтр.
//
// Почему файл появился: до 07.11.2026 ветвь явного выбора в swapOpponentCandidates (executor.ts
// L673-681) возвращала выбранного соперника ДО фильтра. Защищённая карта (cannot_be_targeted)
// проходила предпроверку isActionPossible, а исполнение (collectSide → isTargetableFor) честно
// отказывало: карта в UI выглядела играбельной, ход не проходил. Тот же класс, что BUG-SWAP-03/05.
// Ни один из 53 сьютов гейта зону swap-кандидатов не покрывал: в server/test/** не было ни одного
// упоминания swapEligibleOwners / swapCandidatesFor, всё держалось на пробниках.
//
// Почему синтетика, а не каталог: в data/catalog.v2.json НОЛЬ карт с cannot_be_targeted, поэтому
// на реальных данных дефект недостижим и зелёный тест на карте из каталога ничего не доказывал бы.
// Объекты карт создаются прямо здесь; .from фикстуры для флага не используются (это давало ложные PASS).
//
// Что именно наблюдается: swapOpponentCandidates не экспортируется, поэтому граница
// «предпроверка отказала» / «исполнение отказало» ловится счётчиком чтений action.quantity —
// isActionPossible для 'swap' quantity НЕ читает, executeAction читает его в swapQuantity (L1383).
// При верном коде защищённый соперник отсекается уже на предпроверке: ok=false при reads=0.
// На мутанте «вернуть выбранного без фильтра» исполнение стартует и падает: ok=false при reads=1.
// Контроль N2 (свободный соперник) доказывает, что счётчик вообще растёт, когда swap исполняется.
import {
  resolveActions,
  swapCandidatesFor,
} from '../src/engine/executor';
import { EventBus } from '../src/engine/events';

const SWAP_SRC = 'swap_src';

// Карта-объект под тест: поля, которые читает движок (id, type для card_group, флаг защиты).
function card(id: string, extra: Record<string, any> = {}): any {
  return { id, name: id, name_en: id, type: 'magic', text: '', ...extra } as any;
}

function player(id: string, hand: string[]): any {
  return { id, hand: [...hand], stable: [], discard: [], deck: [], nursery: [], field: [], action_points: 1 };
}

// Колода непустая: иначе maybeEndOnDeckEmpty может закрыть игру до проверки зон.
function makeState(cards: Record<string, any>, hands: Record<string, string[]>): any {
  const defs = [['p1', hands.p1], ['p2', hands.p2], ['p3', hands.p3]].filter(([, h]) => Array.isArray(h)) as [string, string[]][];
  return {
    players: defs.map(([id, h]) => player(id, h)),
    cards,
    deck: ['z1', 'z2'],
    nursery: [],
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: true },
  } as any;
}

// Легаси-диалект swap: стороны задаются явными .a/.b (каталог v2 держит .target/.destination).
// quantity висит геттером на самом действии: swapQuantity читает a.quantity ?? b.quantity ?? action.quantity.
function swapAction(counter: { reads: number }): any {
  const action: any = {
    kind: 'swap',
    a: { scope: 'self', zone: 'hand', filters: { card_group: 'any' } },
    b: { scope: 'opponent', zone: 'hand', filters: { card_group: 'any' } },
  };
  Object.defineProperty(action, 'quantity', {
    get() {
      counter.reads++;
      return { value: 1 };
    },
    enumerable: true,
    configurable: true,
  });
  return action;
}

// Один прогон: явный выбор соперника (selected) или автоподбор (selected === undefined).
async function playSwap(state: any, selected?: string) {
  const counter = { reads: 0 };
  const ctx: any = { state, bus: new EventBus(), currentSourceId: SWAP_SRC, selectedTargets: {} };
  if (selected) ctx.selectedPlayers = { [SWAP_SRC]: [selected] };
  const ok = await resolveActions(ctx, state.players[0], [swapAction(counter)]);
  const hands: Record<string, string[]> = {};
  for (const p of state.players) hands[p.id] = [...p.hand];
  return { ok, reads: counter.reads, hands };
}

describe('swap: кандидаты стороны B (явный выбор и автоподбор через один фильтр)', () => {
  // N1 — убийца мутанта. Явно выбран p2, его единственная карта помечена cannot_be_targeted.
  // Верный код: swapEligibleOwners отсекает p2 → isActionPossible=false → исполнение НЕ стартует (reads=0).
  // Мутант 'return [hit];' в L681: bResolved=[p2] → предпроверка говорит «можно» → executeAction
  // стартует, читает quantity (reads=1) и отказывает collectSide — зоны те же, ok тот же FALSE.
  // Поэтому различает кейсы именно reads: 0 против 1.
  it('N1: явный выбор защищённой карты p2 — предпроверка отказывает до исполнения (reads=0)', async () => {
    const state = makeState(
      { a1: card('a1'), b1: card('b1', { cannot_be_targeted: true }), c1: card('c1') },
      { p1: ['a1'], p2: ['b1'], p3: ['c1'] },
    );

    const res = await playSwap(state, 'p2');

    expect({ ok: res.ok, reads: res.reads, hands: res.hands }).toEqual({
      ok: false,
      reads: 0,
      hands: { p1: ['a1'], p2: ['b1'], p3: ['c1'] },
    });
  });

  // N2 — контроль невырожденности: тот же расклад, но выбран свободный p3. Если бы фильтр
  // отсекал всех подряд, кейс был бы красным. Обмен обязан состояться, p2 не тронут.
  it('N2: явный выбор свободного p3 — обмен проходит, p2 не тронут', async () => {
    const state = makeState(
      { a1: card('a1'), b1: card('b1', { cannot_be_targeted: true }), c1: card('c1') },
      { p1: ['a1'], p2: ['b1'], p3: ['c1'] },
    );

    const res = await playSwap(state, 'p3');

    expect({
      ok: res.ok,
      executed: res.reads > 0,
      hands: res.hands,
    }).toEqual({
      ok: true,
      executed: true,
      hands: { p1: ['c1'], p2: ['b1'], p3: ['a1'] },
    });
  });

  // N3 — автоподбор без selectedPlayers на 3 игроках. Ранний 'return owners' снят (BUG-SWAP-05),
  // поэтому защищённый p2 обязан выпасть и остаться ровно один кандидат p3 — не undefined и не оба.
  it('N3: автоподбор при защищённом p2 — ровно один кандидат p3, обмен с ним', async () => {
    const state = makeState(
      { a1: card('a1'), b1: card('b1', { cannot_be_targeted: true }), c1: card('c1') },
      { p1: ['a1'], p2: ['b1'], p3: ['c1'] },
    );

    const res = await playSwap(state);

    expect({
      ok: res.ok,
      executed: res.reads > 0,
      hands: res.hands,
    }).toEqual({
      ok: true,
      executed: true,
      hands: { p1: ['c1'], p2: ['b1'], p3: ['a1'] },
    });
  });

  // N4 — сервисный путь (окно выбора соперника в транспорте) обязан отдавать тех же кандидатов,
  // что и движок: одна карта не таргетируема — p2 в списке отсутствует. Кейс НЕ красит мутант
  // ветви явного выбора (swapCandidatesFor идёт сразу через swapEligibleOwners) — это контроль
  // паритета сервиса и движка, а убивает мутант N1.
  it('N4: swapCandidatesFor отдаёт ровно p3 — ни защищённого p2, ни пустого списка', async () => {
    const state = makeState(
      { a1: card('a1'), b1: card('b1', { cannot_be_targeted: true }), c1: card('c1') },
      { p1: ['a1'], p2: ['b1'], p3: ['c1'] },
    );
    const counter = { reads: 0 };
    const action = swapAction(counter);

    const service = swapCandidatesFor(state, 'p1', action);
    const engine = await playSwap(state);

    expect({
      service,
      serviceReadsQuantity: counter.reads,
      engineHands: engine.hands,
    }).toEqual({
      service: ['p3'],
      serviceReadsQuantity: 0,
      engineHands: { p1: ['c1'], p2: ['b1'], p3: ['a1'] },
    });
  });
});
