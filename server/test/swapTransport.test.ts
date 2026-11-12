// swapTransport: транспорт выбора соперника для swap (BUG-SWAP-04, 07.11.2026).
//
// Что было сломано: движок отказывал, если у swap с destination_player:'chosen' несколько
// кандидатов и выбор не передан, но `/play` этого отказа не замечал — отвечал 200, карта
// уходила из руки, очко действия списывалось, обмена не было. Выбор клиента (targetPlayerId)
// на прямом пути до исполнителя не доезжал.
//
// Правило съюта: фикстуры карт берутся из data/catalog.v2.json как есть (fromCatalog).
// Синтетическая карта T5 — вынужденная: единственная карта каталога с destination_player:'chosen'
// (dirty_deal_spell) окна реакции не открывает, поэтому путь выбора через prefill.playerId
// реальными данными v2 не покрывается. Действие swap в ней — копия действия из каталога.
// Колода в состоянии непустая: при пустых колоде и сбросе maybeEndOnDeckEmpty закрывает партию.
import * as fs from 'fs';
import * as path from 'path';
import { createGame, getState, play, playWithTargets, resolvePending } from './helpers/api';
import { baseTurn, gameState, player } from './helpers/state';

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'catalog.v2.json');
const rawCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const CATALOG: any[] = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.cards || rawCatalog.data || [];
const CATALOG_BY_ID = new Map<string, any>(CATALOG.map((c) => [String(c.id), c]));
const SWAP_CARD_ID = 'dirty_deal_spell';
const SYNTH_CARD_ID = 'u_swap_chosen';

function fromCatalog(catalogId: string): any {
  const src = CATALOG_BY_ID.get(catalogId);
  if (!src) throw new Error('карты нет в catalog.v2.json: ' + catalogId);
  return JSON.parse(JSON.stringify(src));
}

function swapActionOf(card: any): any {
  for (const eff of card.effects || []) {
    if (eff.trigger !== 'on_play' && eff.trigger !== 'immediate') continue;
    const hit = (eff.actions || []).find((a: any) => String(a.kind) === 'swap');
    if (hit) return JSON.parse(JSON.stringify(hit));
  }
  throw new Error('у карты ' + card.id + ' нет действия swap');
}

function filler(id: string) {
  return { id, type: 'magic', name: id } as any;
}

// Синтетическая карта: единорог с on_play swap — hasUnicornOnPlayEffect открывает окно реакции.
function syntheticChosenSwap() {
  return {
    id: SYNTH_CARD_ID,
    type: 'basic_unicorn',
    name: 'Синтетический обмен',
    effects: [{ trigger: 'on_play', actions: [swapActionOf(fromCatalog(SWAP_CARD_ID))] }],
  } as any;
}

type Setup = { p2Hand: string[]; p3Hand: string[]; cardId?: string };

function threePlayerState({ p2Hand, p3Hand, cardId = SWAP_CARD_ID }: Setup) {
  const source = cardId === SYNTH_CARD_ID ? syntheticChosenSwap() : fromCatalog(SWAP_CARD_ID);
  const cards: Record<string, any> = { [SWAP_CARD_ID]: fromCatalog(SWAP_CARD_ID), [SYNTH_CARD_ID]: syntheticChosenSwap() };
  cards[source.id] = source;
  for (const id of ['h1', ...p2Hand, ...p3Hand]) cards[id] = filler(id);
  return gameState({
    players: [
      player({ id: 'p1', hand: [cardId, 'h1'] }),
      player({ id: 'p2', hand: p2Hand }),
      player({ id: 'p3', hand: p3Hand }),
    ],
    cards,
    turn: baseTurn('p1', 'action', true),
    deck: ['z1', 'z2'],
  });
}

function zonesOf(state: any) {
  return {
    p1: [...state.players[0].hand].sort(),
    p2: state.players[1].hand,
    p3: state.players[2].hand,
    discard: state.players[0].discard,
    ap: state.players[0].action_points,
  };
}

describe('swapTransport: выбор соперника для swap (BUG-SWAP-04)', () => {
  it('T1. Выбор не передан при двух кандидатах: 409 needTargets/kind players, зоны и AP не тронуты', async () => {
    const gid = await createGame(threePlayerState({ p2Hand: ['a1', 'a2'], p3Hand: ['b1'] }));

    const res = await play(gid, SWAP_CARD_ID);
    expect({ status: res.status, needTargets: res.body.needTargets, kind: res.body.kind }).toEqual({
      status: 409,
      needTargets: true,
      kind: 'players',
    });
    expect(res.body.options.players).toEqual(['p2', 'p3']);

    // Отказ не мутирует состояние: карта в руке, очко действия не списано, руки соперников те же.
    const state = await getState(gid);
    expect(zonesOf(state)).toEqual({
      p1: [SWAP_CARD_ID, 'h1'],
      p2: ['a1', 'a2'],
      p3: ['b1'],
      discard: [],
      ap: 1,
    });
  });

  it('T2. targetPlayerId:p2 — обмен состоялся, p3 и лишние копии не задеты', async () => {
    const gid = await createGame(threePlayerState({ p2Hand: ['a1', 'a2'], p3Hand: ['b1'] }));

    const res = await play(gid, SWAP_CARD_ID, { targetPlayerId: 'p2' });
    expect(res.status).toBe(200);

    const state = await getState(gid);
    expect({ p1: [...state.players[0].hand].sort(), p2: state.players[1].hand, p3: state.players[2].hand }).toEqual({
      p1: ['a1', 'a2'],
      p2: ['h1'],
      p3: ['b1'],
    });
    // Разыгранная карта покинула руки: суммарно на одну меньше, дублей между руками нет.
    const all = [...state.players[0].hand, ...state.players[1].hand, ...state.players[2].hand];
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(4);
  });

  it('T3. Единственный кандидат (у p3 пустая рука) — 200 без явного выбора, автоподбор движка', async () => {
    const gid = await createGame(threePlayerState({ p2Hand: ['a1', 'a2'], p3Hand: [] }));

    const res = await play(gid, SWAP_CARD_ID);
    expect(res.status).toBe(200);

    const state = await getState(gid);
    expect({ p1: [...state.players[0].hand].sort(), p2: state.players[1].hand, p3: state.players[2].hand }).toEqual({
      p1: ['a1', 'a2'],
      p2: ['h1'],
      p3: [],
    });
  });

  it('T4. targetPlayerId не из кандидатов (p3 без карт) — 400 invalid, мутаций нет', async () => {
    const gid = await createGame(threePlayerState({ p2Hand: ['a1', 'a2'], p3Hand: [] }));

    const res = await play(gid, SWAP_CARD_ID, { targetPlayerId: 'p3' });
    expect({ status: res.status, invalid: res.body.invalid, kind: res.body.kind }).toEqual({
      status: 400,
      invalid: 'p3',
      kind: 'players',
    });
    expect(res.body.options.players).toEqual(['p2']);

    const state = await getState(gid);
    expect(zonesOf(state)).toEqual({
      p1: [SWAP_CARD_ID, 'h1'],
      p2: ['a1', 'a2'],
      p3: [],
      discard: [],
      ap: 1,
    });
  });

  it('T5. Окно реакции + chosen-swap: выбор из /play доезжает до исполнителя через prefill', async () => {
    const gid = await createGame(threePlayerState({ p2Hand: ['a1', 'a2'], p3Hand: ['b1'], cardId: SYNTH_CARD_ID }));

    const res = await play(gid, SYNTH_CARD_ID, { targetPlayerId: 'p2' });
    expect(res.status).toBe(200);
    // Окно реакции действительно открылось — иначе кейс проверял бы прямой путь (T2).
    expect(res.body.pending?.kind).toBe('play');

    await resolvePending(gid);

    const state = await getState(gid);
    expect({ p1: [...state.players[0].hand].sort(), p2: state.players[1].hand, p3: state.players[2].hand }).toEqual({
      p1: ['a1', 'a2'],
      p2: ['h1'],
      p3: ['b1'],
    });
  });

  // BUG-SWAP-05: при нуле кандидатов отказ обязан быть терминальным. До фикса в options.players
  // уезжал список соперников с пустой зоной обмена, клиент открывал окно выбора, а повторный
  // /play с таким targetPlayerId падал в 400 — выбор был невыполним по построению.
  it('T6. Кандидатов нет ни у кого — 409 терминальный, без needTargets и options.players', async () => {
    const gid = await createGame(threePlayerState({ p2Hand: [], p3Hand: [] }));

    const res = await play(gid, SWAP_CARD_ID);
    expect({
      status: res.status,
      needTargets: typeof res.body.needTargets === 'undefined' ? null : res.body.needTargets,
      noSwapCandidates: res.body.noSwapCandidates,
    }).toEqual({ status: 409, needTargets: null, noSwapCandidates: true });
    // Список игроков не отдаём вовсе: иначе UI откроет окно выбора.
    expect(res.body.options?.players).toBeUndefined();
    expect(res.body.options).toBeUndefined();
    // Клиент открывает окно ещё и по тексту /target player/i — текст отказа его не ловит.
    expect(/target player/i.test(String(res.body.message || ''))).toBe(false);

    const state = await getState(gid);
    expect(zonesOf(state)).toEqual({
      p1: [SWAP_CARD_ID, 'h1'],
      p2: [],
      p3: [],
      discard: [],
      ap: 1,
    });

    // Тупик закрыт: повтор с выбранным «соперником без карт» не проходит и ничего не меняет.
    const again = await play(gid, SWAP_CARD_ID, { targetPlayerId: 'p2' });
    expect(again.status).not.toBe(200);
    expect(zonesOf(await getState(gid))).toEqual({
      p1: [SWAP_CARD_ID, 'h1'],
      p2: [],
      p3: [],
      discard: [],
      ap: 1,
    });
  });

  // Дубль-guard в routes/game.ts playWithTargets обязан вести себя так же, как сервис.
  it('T7. Путь playWithTargets отдаёт тот же терминальный 409 без окна выбора', async () => {
    const gid = await createGame(threePlayerState({ p2Hand: [], p3Hand: [] }));

    const res = await playWithTargets(gid, { cardId: SWAP_CARD_ID });
    expect({
      status: res.status,
      needTargets: typeof res.body.needTargets === 'undefined' ? null : res.body.needTargets,
      noSwapCandidates: res.body.noSwapCandidates,
    }).toEqual({ status: 409, needTargets: null, noSwapCandidates: true });
    expect(res.body.options).toBeUndefined();

    expect(zonesOf(await getState(gid))).toEqual({
      p1: [SWAP_CARD_ID, 'h1'],
      p2: [],
      p3: [],
      discard: [],
      ap: 1,
    });
  });
});
