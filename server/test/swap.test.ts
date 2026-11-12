// swap: единственное действие 'swap' в каталоге v2 — dirty_deal_spell («Нечестная сделка»):
// «Поменяйтесь всеми картами на руке с картами на руке другого игрока».
//
// Почему файл появился: до 07.11.2026 swap не покрывал ни один из 55 сьютов server/test/**,
// и ветвь case 'swap' падала TypeError на (undefined).zone (каталог даёт .target, ветвь читала .a/.b).
// Бэкенд устранил падение (executor.ts, sha 77524fc9…), но пробник на реальной карте показал,
// что обмен руками фактически не выполняется — эти кейсы фиксируют расхождение с текстом карты.
//
// Правило съюта: фикстуры берутся из data/catalog.v2.json как есть (fromCatalog), подставные карты
// (filler) — только для зон вне проверяемого эффекта. Колода в makeState непустая: иначе
// maybeEndOnDeckEmpty может закрыть игру до проверки зон.
import * as fs from 'fs';
import * as path from 'path';
import { resolveActions, ResolveContext } from '../src/engine/executor';
import { EventBus } from '../src/engine/events';
import { Action } from '../../shared/src/types';

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'catalog.v2.json');
const rawCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const CATALOG: any[] = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.cards || rawCatalog.data || [];
const CATALOG_BY_ID = new Map<string, any>(CATALOG.map((c) => [String(c.id), c]));
const SWAP_CARD_ID = 'dirty_deal_spell';

function fromCatalog(catalogId: string): any {
  const src = CATALOG_BY_ID.get(catalogId);
  if (!src) throw new Error('карты нет в catalog.v2.json: ' + catalogId);
  return JSON.parse(JSON.stringify(src));
}

function swapActionOf(card: any): any {
  for (const eff of card.effects || []) {
    const hit = (eff.actions || []).find((a: any) => String(a.kind) === 'swap');
    if (hit) return JSON.parse(JSON.stringify(hit));
  }
  throw new Error('у карты ' + card.id + ' нет действия swap');
}

function makeState(cards: Record<string, any>, p1Hand: string[], p2Hand: string[]) {
  const mkPlayer = (id: string, hand: string[]) => ({
    id,
    deck: [],
    hand: [...hand],
    discard: [],
    stable: [],
    nursery: [],
    field: [],
    action_points: 1,
  });
  return {
    players: [mkPlayer('p1', p1Hand), mkPlayer('p2', p2Hand)],
    cards,
    deck: ['z1', 'z2'],
    nursery: [],
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: false },
  } as any;
}

function makeCtx(state: any, sourceId: string, selectedTargets: Record<string, string[]> = {}): ResolveContext {
  return { state, bus: new EventBus(), selectedTargets, currentSourceId: sourceId } as any;
}

const sortIds = (arr: string[]) => [...arr].sort();

describe('swap (dirty_deal_spell): обмен картами руки через действие swap', () => {
  it('S1: по одной карте у каждого — обмен состоялся, обе руки поменялись', async () => {
    const source = fromCatalog(SWAP_CARD_ID);
    const mine = fromCatalog('apprentice_unicorn');
    const theirs = fromCatalog('rainbow_aura_upgrade');

    const state = makeState({ [source.id]: source, [mine.id]: mine, [theirs.id]: theirs }, [mine.id], [theirs.id]);
    const ctx = makeCtx(state, source.id);

    const ok = await resolveActions(ctx, state.players[0], [swapActionOf(source) as unknown as Action]);

    expect({
      ok,
      p1: state.players[0].hand,
      p2: state.players[1].hand,
    }).toEqual({ ok: true, p1: [theirs.id], p2: [mine.id] });
  });

  // КРАСНЫЙ до фикса D6: текст карты — «всеми картами на руке с картами другого игрока».
  // Факт 07.11.2026: обменяется одна карта внутри своей руки (перестановка), рука соперника не тронута,
  // при этом действие возвращает ok=true — «успех без эффекта».
  it('S2: две карты у каждого — меняются наборы целиком, а не переставляются свои', async () => {
    const source = fromCatalog(SWAP_CARD_ID);
    const a = fromCatalog('apprentice_unicorn');
    const b = fromCatalog('rainbow_aura_upgrade');
    const c = fromCatalog('angelic_baby_unicorn');
    const d = fromCatalog('lucky_streak_spell');

    const state = makeState(
      { [source.id]: source, [a.id]: a, [b.id]: b, [c.id]: c, [d.id]: d },
      [a.id, b.id],
      [c.id, d.id],
    );
    const ctx = makeCtx(state, source.id);

    const ok = await resolveActions(ctx, state.players[0], [swapActionOf(source) as unknown as Action]);

    expect({
      ok,
      p1: sortIds(state.players[0].hand),
      p2: sortIds(state.players[1].hand),
    }).toEqual({ ok: true, p1: sortIds([c.id, d.id]), p2: sortIds([a.id, b.id]) });
  });

  // КРАСНЫЙ до фикса D6: isActionPossible (executor.ts ~L461-466) для swap читает только
  // actionSelector (.from/.source/.target), поэтому легаси-диалект .a/.b отсекается до исполнения.
  // Заявление Бэкенда «легаси-форма с .a/.b исполняется как раньше» этим кейсом не подтверждается.
  it('S3: легаси-диалект .a/.b тоже исполняется, а не отсекается предпроверкой', async () => {
    const source = fromCatalog(SWAP_CARD_ID);
    const mine = fromCatalog('apprentice_unicorn');
    const theirs = fromCatalog('rainbow_aura_upgrade');

    const action = swapActionOf(source);
    delete action.target;
    delete action.targets;
    delete action.destination;
    delete action.destination_player;
    delete action.target_player;
    action.a = { scope: 'self', zone: 'hand', filters: { card_group: 'any' } };
    action.b = { scope: 'opponent', zone: 'hand', filters: { card_group: 'any' } };

    const state = makeState({ [source.id]: source, [mine.id]: mine, [theirs.id]: theirs }, [mine.id], [theirs.id]);
    const ctx = makeCtx(state, source.id);

    const ok = await resolveActions(ctx, state.players[0], [action as unknown as Action]);

    expect({ ok, p1: state.players[0].hand, p2: state.players[1].hand }).toEqual({
      ok: true,
      p1: [theirs.id],
      p2: [mine.id],
    });
  });

  it('S4: явно выбранная дважды одна и та же карта — false без мутаций зон', async () => {
    const source = fromCatalog(SWAP_CARD_ID);
    const mine = fromCatalog('apprentice_unicorn');
    const theirs = fromCatalog('rainbow_aura_upgrade');

    const state = makeState({ [source.id]: source, [mine.id]: mine, [theirs.id]: theirs }, [mine.id], [theirs.id]);
    const ctx = makeCtx(state, source.id, { [source.id]: [mine.id, mine.id] });
    const before = { p1: [...state.players[0].hand], p2: [...state.players[1].hand] };

    const ok = await resolveActions(ctx, state.players[0], [swapActionOf(source) as unknown as Action]);

    expect({ ok, p1: state.players[0].hand, p2: state.players[1].hand }).toEqual({
      ok: false,
      p1: before.p1,
      p2: before.p2,
    });
  });

  // КРАСНЫЙ до фикса D6: обменивать нечего — эффект не исполним, ожидается честный false.
  // Факт 07.11.2026: ok=true при неизменных зонах (второй случай «успеха без эффекта»).
  it('S5: у соперника пустая рука — false, а не ok без эффекта', async () => {
    const source = fromCatalog(SWAP_CARD_ID);
    const mine = fromCatalog('apprentice_unicorn');

    const state = makeState({ [source.id]: source, [mine.id]: mine }, [mine.id], []);
    const ctx = makeCtx(state, source.id);

    const ok = await resolveActions(ctx, state.players[0], [swapActionOf(source) as unknown as Action]);

    expect({ ok, p1: state.players[0].hand, p2: state.players[1].hand }).toEqual({
      ok: false,
      p1: [mine.id],
      p2: [],
    });
  });
});
