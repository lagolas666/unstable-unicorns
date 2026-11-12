// filters.subtype: покрытие пути фильтра, а не только хелпера cardSubtypeTags.
//
// Зачем файл. Задача Аналитика от 07.11.2026: мутанты «теги не выдаются никогда»
// (cardSubtypeTags -> []) и «снять ветку basic_unicorn» проходили полный гейт ЗЕЛЁНЫМ
// (49 сьютов / 472 passed). Через filters.subtype не проходил ни один тест.
//
// Что именно проверяется. Не хелпер сам по себе, а путь: resolveActions ->
// isActionPossible -> countAvailableTargets (executor.ts L509) -> matchesFilter (L246) ->
// cardSubtypeTags (unicornTypes.ts L143). Хелперный юнит-тест такую дыру не закрывает:
// мутация в хелпере видна только в том случае, если до него доходит исполнение действия.
//
// Фикстуры — данные catalog.v2.json (id/type/subtype/source_zone), сравнений по имени карты нет.
// Действие задаётся теми же ключами, что в каталоге: kind + target{scope,zone,filters,quantity}
// (normalizeActionTargets переводит target -> targets внутри движка).

import * as fs from 'fs';
import * as path from 'path';
import { resolveActions, ResolveContext } from '../src/engine/executor';
import { EventBus } from '../src/engine/events';
import { Action } from '../../shared/src/types';

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'catalog.v2.json');
const rawCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const CATALOG: any[] = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.cards || rawCatalog.data || [];
const CATALOG_BY_ID = new Map<string, any>(CATALOG.map((c) => [String(c.id), c]));

/** Копия карты из каталога v2 — единственный источник id/type/subtype/source_zone. */
function fromCatalog(catalogId: string): any {
  const src = CATALOG_BY_ID.get(catalogId);
  if (!src) throw new Error('карты нет в catalog.v2.json: ' + catalogId);
  return JSON.parse(JSON.stringify(src));
}

/** Наполнитель без эффектов: тип задаётся явно, чтобы не притащить в фикстуру лишний подтип. */
function filler(id: string, type = 'basic_unicorn'): any {
  return { id, type, name: id, effects: [] };
}

function makeState(cards: Record<string, any>, stable: string[]) {
  const mkPlayer = (id: string, s: string[]) =>
    ({ id, deck: [], hand: [], discard: [], stable: [...s], nursery: [], field: [], action_points: 1 }) as any;
  return {
    players: [mkPlayer('p1', stable), mkPlayer('p2', [])],
    cards,
    // Непустая колода: пустая колода И пустой сброс завершают партию (правило варианта A).
    deck: ['z1', 'z2'],
    discard: [],
    nursery: [],
    turn: { currentPlayerId: 'p1', phase: 'action', has_drawn: false },
  } as any;
}

function makeCtx(state: any, sourceId: string): ResolveContext {
  return { state, bus: new EventBus(), selectedTargets: {}, currentSourceId: sourceId } as any;
}

/** Действие в форме каталога: target (не targets) — так лежит в catalog.v2.json. */
function sacrificeBySubtype(subtype: string): Action[] {
  return [
    {
      kind: 'sacrifice',
      target: {
        scope: 'self',
        zone: 'stable',
        filters: { card_group: 'unicorn', subtype },
        quantity: { value: 1 },
      },
    },
  ] as unknown as Action[];
}

/** Контроль: то же действие без subtype — доказывает, что путь исполняется вообще. */
function sacrificeAnyUnicorn(): Action[] {
  return [
    {
      kind: 'sacrifice',
      target: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { value: 1 } },
    },
  ] as unknown as Action[];
}

afterEach(() => {
  jest.useRealTimers();
});

describe('filters.subtype доходит до cardSubtypeTags через путь действия', () => {
  it('S1 basic: цель — Обычный единорог, у которого поля subtype в данных НЕТ', async () => {
    const basic = fromCatalog('apprentice_unicorn'); // type basic_unicorn, subtype отсутствует
    const magical = fromCatalog('rhinocorn_magic'); // type magical_unicorn, subtype ['magic']
    const ultimate = fromCatalog('elusive_ocelotcorn_ultimate'); // type ultimate_unicorn, subtype ['ultimate']
    // Страховки фикстуры: без поля subtype у Обычного тег обязан выводиться из type.
    expect(basic.type).toBe('basic_unicorn');
    expect(basic.subtype).toBeUndefined();
    expect(magical.subtype).toEqual(['magic']);
    expect(ultimate.subtype).toEqual(['ultimate']);

    const state = makeState(
      { [basic.id]: basic, [magical.id]: magical, [ultimate.id]: ultimate },
      [magical.id, basic.id, ultimate.id]
    );
    const ctx = makeCtx(state, 'src-basic');
    const ok = await resolveActions(ctx, state.players[0], sacrificeBySubtype('basic'));

    expect(ok).toBe(true);
    // Выбран ровно Обычный, хотя он в середине стойла: автопроход берёт с конца, но фильтр
    // отсеивает Высшего сверху и Магического, поэтому остаётся только basic.
    expect(state.players[0].discard).toEqual([basic.id]);
    expect(state.players[0].stable).toEqual([magical.id, ultimate.id]);
  });

  it('S2 baby_unicorn: берётся настоящий Малыш (source_zone nursery_only) и уходит в Ясли, а не в сброс', async () => {
    const baby = fromCatalog('angelic_baby_unicorn'); // type baby_unicorn + source_zone nursery_only
    const trap = fromCatalog('a_cute_attack'); // type baby_unicorn, source_zone НЕТ — карта-действие
    // Ловушка наивной реализации: тег по одному type поймал бы и карту-действие.
    expect(baby.type).toBe('baby_unicorn');
    expect(baby.source_zone).toBe('nursery_only');
    expect(trap.type).toBe('baby_unicorn');
    expect(trap.source_zone).toBeUndefined();

    const state = makeState({ [baby.id]: baby, [trap.id]: trap }, [baby.id, trap.id]);
    const ctx = makeCtx(state, 'src-baby');
    const ok = await resolveActions(ctx, state.players[0], sacrificeBySubtype('baby_unicorn'));

    expect(ok).toBe(true);
    // Настоящий Малыш ушёл в общие Ясли (правило Даниила: из стойла — обратно в Ясли).
    expect(state.nursery).toEqual([baby.id]);
    expect(state.discard).toEqual([]);
    // Карта-действие с type baby_unicorn целью не стала и осталась в стойле.
    expect(state.players[0].stable).toEqual([trap.id]);
  });

  it('S3 magic: берётся Магический единорог (subtype массивом), а Заклинание с type magic — нет', async () => {
    const magical = fromCatalog('rhinocorn_magic'); // subtype ['magic'] — массив
    const spell = fromCatalog('lucky_streak_spell'); // type 'magic' (Заклинание), subtype отсутствует
    expect(magical.subtype).toEqual(['magic']);
    expect(spell.type).toBe('magic');
    expect(spell.subtype).toBeUndefined();

    const state = makeState({ [magical.id]: magical, [spell.id]: spell }, [magical.id, spell.id]);
    const ctx = makeCtx(state, 'src-magic');
    const ok = await resolveActions(ctx, state.players[0], sacrificeBySubtype('magic'));

    expect(ok).toBe(true);
    expect(state.players[0].discard).toEqual([magical.id]);
    // Заклинание осталось: тег magic выводится только из type magical_unicorn.
    expect(state.players[0].stable).toEqual([spell.id]);
  });

  it('S4 ultimate: берётся Высший единорог по тегу из массива subtype', async () => {
    const ultimate = fromCatalog('elusive_ocelotcorn_ultimate');
    const basic = fromCatalog('apprentice_unicorn');
    expect(ultimate.subtype).toEqual(['ultimate']);

    const state = makeState({ [ultimate.id]: ultimate, [basic.id]: basic }, [basic.id, ultimate.id]);
    const ctx = makeCtx(state, 'src-ultimate');
    const ok = await resolveActions(ctx, state.players[0], sacrificeBySubtype('ultimate'));

    expect(ok).toBe(true);
    expect(state.players[0].discard).toEqual([ultimate.id]);
    expect(state.players[0].stable).toEqual([basic.id]);
  });

  it('S5 контроль: без subtype исполнение идёт по card_group и жертвует верх стойла', async () => {
    const basic = fromCatalog('apprentice_unicorn');
    const ultimate = fromCatalog('elusive_ocelotcorn_ultimate');
    const state = makeState({ [basic.id]: basic, [ultimate.id]: ultimate }, [basic.id, ultimate.id]);
    const ctx = makeCtx(state, 'src-control');
    const ok = await resolveActions(ctx, state.players[0], sacrificeAnyUnicorn());

    // Невакуумность: путь исполняется и без subtype, поэтому красный на S1–S4 — это фильтр,
    // а не сломанный sacrifice.
    expect(ok).toBe(true);
    expect(state.players[0].discard).toEqual([ultimate.id]); // верх стойла
    expect(state.players[0].stable).toEqual([basic.id]);
  });
});
