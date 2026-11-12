// D5: селектор действия лежит в .target (как в catalog.v2.json), а движок читает .from/.source.
//
// Зачем файл. Проверка 07.11.2026 по коду:
//   - normalizeActionTargets (executor.ts L479-483) делает ТОЛЬКО target -> targets и никогда
//     не создаёт .from/.source;
//   - isActionPossible L463 для move/steal/give/swap/return читает (action as any).from
//     и при его отсутствии возвращает false — действие выпадает из эффекта целиком;
//   - ветви case 'move' (L1041) и case 'give/return/transfer' (L1123) читают .from и .to;
//   - case 'add' (L941-942) читает action.source / action.destination.
// Скан всех 329 карт каталога (_te_sel_shapes.js): у 65 действий переноса ключ .from
// отсутствует у ВСЕХ (7 return + 19 move + 6 pull + 6 return_to_hand + 18 steal + 3 add
// + 3 give + 1 swap). Форма данных: target + destination.
//
// Значит дефект не «фильтр игнорируется», а селектор не доезжает: ветви недостижимы на реальных данных.
//
// Второй тест — контроль (не проверка дефекта): то же действие, переписанное в легаси-диалект
// { from, to }, обязано исполниться и ЗЕЛЁНОЕ. Он доказывает, что путь move рабочий, а красный
// в первом тесте даёт ровно несовпадение имени ключа. После починки контроль обязан остаться
// зелёным (обратная совместимость action.from ?? action.target).
//
// Фикстуры — только объекты из catalog.v2.json; сравнений по имени карты нет.

import * as fs from 'fs';
import * as path from 'path';
import { resolveActions, ResolveContext } from '../src/engine/executor';
import { EventBus } from '../src/engine/events';
import { Action } from '../../shared/src/types';

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'catalog.v2.json');
const rawCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const CATALOG: any[] = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.cards || rawCatalog.data || [];
const CATALOG_BY_ID = new Map<string, any>(CATALOG.map((c) => [String(c.id), c]));

/** Копия карты из каталога v2 — единственный источник id/type/subtype/source_zone/effects. */
function fromCatalog(catalogId: string): any {
  const src = CATALOG_BY_ID.get(catalogId);
  if (!src) throw new Error('карты нет в catalog.v2.json: ' + catalogId);
  return JSON.parse(JSON.stringify(src));
}

/** Наполнитель без эффектов: только для целей, которые НЕ участвуют в селекторе. */
function filler(id: string, type = 'basic_unicorn'): any {
  return { id, type, name: id, effects: [] };
}

/**
 * Состояние без общих стопок discard/nursery намеренно: getZoneArrayWithShared (L232-236)
 * при непустом state.discard возвращает ОБЩИЙ сброс и подменяет сброс игрока — на этом
 * ловятся фикстуры, где «карта в сбросе p1» на деле лежит в общей стопке.
 */
function makeState(cards: Record<string, any>, p1: { stable?: string[]; hand?: string[]; discard?: string[] }) {
  const mkPlayer = (id: string, zones: { stable?: string[]; hand?: string[]; discard?: string[] }) =>
    ({
      id,
      deck: [],
      hand: [...(zones.hand || [])],
      discard: [...(zones.discard || [])],
      stable: [...(zones.stable || [])],
      nursery: [],
      field: [],
      action_points: 1,
    }) as any;
  return {
    players: [mkPlayer('p1', p1), mkPlayer('p2', {})],
    cards,
    // Непустая колода: пустая колода И пустой сброс завершают партию (правило варианта A).
    deck: ['z1', 'z2'],
    nursery: [],
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: false },
  } as any;
}

function makeCtx(state: any, sourceId: string): ResolveContext {
  return { state, bus: new EventBus(), selectedTargets: {}, currentSourceId: sourceId } as any;
}

/** Первое действие нужного вида из реальных effects карты — как оно лежит в каталоге. */
function firstActionOf(card: any, kind: string, actionIndex = 0): any {
  for (const eff of card.effects || []) {
    const acts: any[] = (eff as any).actions || [];
    const hit = acts.find((a) => String(a.kind) === kind);
    if (hit) return { effect: eff, action: JSON.parse(JSON.stringify(hit)), actionIndex };
  }
  throw new Error('у карты ' + card.id + ' нет действия ' + kind);
}

afterEach(() => {
  jest.useRealTimers();
});

describe('D5: селектор действия — .target из каталога против .from/.source в движке', () => {
  // zombie_unicorn_magic: move { scope self, zone discard, filters card_group unicorn } -> destination stable
  // Условия фикстуры невыгодные: единственный подходящий единорог лежит НЕ сверху и не в конце.
  it('D5-a: move с настоящим .target обязан исполниться и переставить карту', async () => {
    const source = fromCatalog('zombie_unicorn_magic');
    const { action } = firstActionOf(source, 'move');
    const targetCard = fromCatalog('apprentice_unicorn'); // обычный единорог, подходит по card_group
    const noise = filler('noise-1');

    // Страховки фикстуры: в каталоге селектор в .target, ключа .from нет вовсе.
    expect(action.kind).toBe('move');
    expect(action.target).toBeDefined();
    expect(action.from).toBeUndefined();
    expect(action.target.zone).toBe('discard');
    expect(action.destination).toBe('stable');

    const state = makeState({ [source.id]: source, [targetCard.id]: targetCard, [noise.id]: noise }, {
      discard: [targetCard.id],
    });
    const ctx = makeCtx(state, source.id);
    const before = { discard: [...state.players[0].discard], stable: [...state.players[0].stable] };

    const ok = await resolveActions(ctx, state.players[0], [action as unknown as Action]);

    // Красный по D5 = этот ассерт с Received: false (действие выпало, потому что .from нет),
    // а НЕ ok=false от «цель не нашлась»: карта в сбросе есть, и это проверено строкой выше.
    expect({ ok, discard: state.players[0].discard, stable: state.players[0].stable }).toEqual({
      ok: true,
      discard: [],
      stable: [targetCard.id],
    });
    // Физика: карта действительно ушла из сброса в стойло, а не «ok=true без переноса».
    expect(before.discard).toEqual([targetCard.id]);
  });

  it('D5-b контроль: то же действие в легаси-диалекте {from,to} обязано быть ЗЕЛЁНЫМ', async () => {
    const source = fromCatalog('zombie_unicorn_magic');
    const { action } = firstActionOf(source, 'move');
    const targetCard = fromCatalog('apprentice_unicorn');

    // Тот же селектор, то же количество, та же карта в том же сбросе. Отличие ОДНО — имя ключа.
    const legacy: any = {
      kind: 'move',
      from: JSON.parse(JSON.stringify(action.target)),
      to: { scope: 'self', zone: 'stable' },
    };
    expect(action.from).toBeUndefined();
    expect(legacy.from.filters.card_group).toBe('unicorn');

    const state = makeState({ [source.id]: source, [targetCard.id]: targetCard }, {
      discard: [targetCard.id],
    });
    const ctx = makeCtx(state, source.id);
    const ok = await resolveActions(ctx, state.players[0], [legacy as Action]);

    // Если этот контроль красный — путь move сломан целиком и D5-a доказывает не то.
    expect(ok).toBe(true);
    expect(state.players[0].discard).toEqual([]);
    expect(state.players[0].stable).toEqual([targetCard.id]);
  });

  // RF-7 (не D5): add читает action.source/action.destination, которых в каталоге нет.
  // Сейчас падает «Unsupported concrete zone for player view: undefined» — дефект резолвера зон,
  // чинится фазой D2. Держим skip, чтобы не смешивать два дефекта в одном красном.
  it.skip('RF-7: add с настоящим .target (rainbow_unicorn_magic) — отдельный дефект зоны', async () => {
    const source = fromCatalog('rainbow_unicorn_magic');
    const { action } = firstActionOf(source, 'add');
    const targetCard = fromCatalog('apprentice_unicorn');
    expect(action.target).toBeDefined();
    expect(action.source).toBeUndefined();

    const state = makeState({ [source.id]: source, [targetCard.id]: targetCard }, {
      hand: [targetCard.id],
    });
    const ctx = makeCtx(state, source.id);
    const ok = await resolveActions(ctx, state.players[0], [action as unknown as Action]);
    expect(ok).toBe(true);
  });
});
