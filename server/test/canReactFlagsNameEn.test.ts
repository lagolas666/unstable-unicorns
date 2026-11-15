/**
 * Страж fallback'а canReactFlags на поле name_en (каталог v2).
 *
 * Контекст. С 03.11.2026 база карт — server/data/catalog.v2.json (329 карт), собранная
 * из UNICORNS.md: у 161 карты поле name русское, английское имя лежит в name_en.
 * Таблица CAN_REACT_FLAGS ключуется английскими именами, поэтому src/data/canReactFlags.ts
 * сначала ищет флаги по card.name, а если набор пуст — по card.name_en.
 *
 * Дефект, который сторожит этот файл. Без fallback 'Супер отмена' (name_en 'Super Neigh')
 * молча теряет cannot_be_neighed: карту можно отменить обычным Neigh и Counter-Neigh,
 * то есть нарушается правило 1 Даниила. До этого файла мутация «снять fallback на name_en»
 * давала 81 passed / 0 failed — покрытия ветки не было вообще.
 *
 * Проверяется только публичный API: applyCanReactFlags / applyCanReactFlagsToDict /
 * canReactFlagsForCardName. Приватный hasAnyFlag не читается.
 *
 * Разрешено трогать только server/test/**. Если проверка краснеет — это находка в src/**,
 * о ней сообщается как BLOCKED, а не правится здесь.
 */

import {
  applyCanReactFlags,
  applyCanReactFlagsToDict,
  canReactFlagsForCardName,
  CAN_REACT_FLAGS,
} from '../src/data/canReactFlags';
import { loadCatalogFixture, catalogFixturePath } from '../src/data/catalog';

type Card = Record<string, any>;

describe('canReactFlags: поиск флагов по name_en (каталог v2)', () => {
  it('F1: карта с русским name и name_en Super Neigh получает cannot_be_neighed', () => {
    const card: Card = { id: 'x1', name: 'Супер отмена', name_en: 'Super Neigh' };
    const out = applyCanReactFlags(card);

    expect(out.cannot_be_neighed).toBe(true);
    // та же карта возвращается на месте — вызывающая сторона кладёт её в state.cards
    expect(out).toBe(card);
  });

  it('F2: карта без name_en флаг НЕ получает', () => {
    const card: Card = { id: 'x2', name: 'Супер отмена' };
    const out = applyCanReactFlags(card);

    expect(out.cannot_be_neighed).toBeUndefined();
    expect(Object.keys(out)).toEqual(['id', 'name']);
  });

  it('F3: английский name_en у карты с посторонним name тоже работает', () => {
    const card: Card = { id: 'x3', name: 'Отмена', name_en: 'Neigh' };
    const out = applyCanReactFlags(card);

    // 'neigh' в таблице флагов нет — набор остаётся пустым, лишних полей не появляется
    expect(out.cannot_be_neighed).toBeUndefined();
    expect(canReactFlagsForCardName('Neigh')).toEqual({});
  });

  it('F4: name_en с другим регистром и пробелами нормализуется', () => {
    const card: Card = { id: 'x4', name: 'Супер отмена', name_en: '  sUpEr NeIgH  ' };
    expect(applyCanReactFlags(card).cannot_be_neighed).toBe(true);
  });

  it('F5: флаги самого name приоритетнее — name_en не перебивает непустой набор', () => {
    // name даёт blocks_neigh_against_owner, name_en — cannot_be_neighed.
    // Fallback включается только на ПУСТОМ наборе, поэтому cannot_be_neighed не появляется.
    const card: Card = { id: 'x5', name: 'Yay', name_en: 'Super Neigh' };
    const out = applyCanReactFlags(card);

    expect(out.blocks_neigh_against_owner).toBe(true);
    expect(out.cannot_be_neighed).toBeUndefined();
  });

  it('F6: name_en без совпадения не ломает карту', () => {
    const card: Card = { id: 'x6', name: 'Отмена', name_en: 'No Such Card Name' };
    const out = applyCanReactFlags(card);
    expect(Object.keys(out)).toEqual(['id', 'name', 'name_en']);
  });

  it('F7: applyCanReactFlagsToDict накладывает флаг на весь словарь', () => {
    const dict: Record<string, Card> = {
      a: { id: 'a', name: 'Супер отмена', name_en: 'Super Neigh' },
      b: { id: 'b', name: 'Супер отмена' },
    };
    const out = applyCanReactFlagsToDict(dict);

    expect(out).toBe(dict);
    expect(dict.a.cannot_be_neighed).toBe(true);
    expect(dict.b.cannot_be_neighed).toBeUndefined();
  });

  it('F8: реальная карта v2 super_neigh_instant получает флаг', () => {
    const path = catalogFixturePath();
    expect(typeof path).toBe('string');
    expect(String(path)).toMatch(/catalog\.v2\.json$/);

    const cards = loadCatalogFixture();
    expect(cards.length).toBe(329);

    const card = cards.find((c: any) => c.id === 'super_neigh_instant') as Card | undefined;
    expect(card).toBeDefined();
    // в v2 имя русское, английское — в name_en: именно этот случай и покрывает fallback
    expect(card!.name).toBe('Супер отмена');
    expect(card!.name_en).toBe('Super Neigh');

    // копия, чтобы не мутировать закэшированный каталог между тестами
    const probe = applyCanReactFlags({ ...(card as Card) });
    expect(probe.cannot_be_neighed).toBe(true);
  });

  it('F9: blocks_neigh_for_others берётся из флагов карты, а не из её имени', () => {
    const dataDrivenCard: Card = {
      id: 'x9',
      name: 'Generic blocker',
      static_properties: { blocks_neigh_for_others: true },
    };
    const out = applyCanReactFlags(dataDrivenCard);

    expect(out.blocks_neigh_for_others).toBe(true);
    expect(canReactFlagsForCardName('Generic blocker')).toEqual({});
  });
});
