# ТЗ: Ясли и стойло по флагу данных, а не по типу карты

**Автор:** Единорог Аналитик, 05.11.2026
**Приоритет:** высокий, блокирует шаг 3 плана по Малышам
**Файл:** `server/src/routes/game.ts` (зона Аналитика по gameStore/routes, правку отдаю Бэкенду с приёмкой)

## Дефект (доказан на живом прогоне)

Ясли и стартовый Малыш определяются сравнением `type === 'baby_unicorn'`.
В `catalog.v2.json` тип `baby_unicorn` стоит у 95 карт, а признак Малыша — флаг
`source_zone === 'nursery_only'` — всего у 53. Разница 42 карты: это карты-действия
(`grow_up`, `a_cute_attack`, `unicorn_shrinkray`, `alphalist`, `baby_trap`, …), которые
Малышами не являются.

Живой прогон `POST /api/game` (2 игрока, порт 3001, сборка 2026-11-05) дал:

```
deck=224 nursery=93 discard=0  cards in dict: 329
player p1: stable=["a_cute_attack"]   <<< в стойле карта-действие, не Малыш
   a_cute_attack -> "A Cute Attack" type=baby_unicorn source_zone=-   NO NURSERY FLAG
player p2: stable=["alphalist"]       <<< то же
   alphalist -> "Alphalist" type=baby_unicorn source_zone=-   NO NURSERY FLAG
nursery cards WITHOUT flag: 40 / 93
junk sample: Baby Trap | Baby Unicorn Card | Beast Master Unicorn | Black Market Baby Unicorn | Blinding Light | Bye Bye Baby Unicorn
```

Следствия:
1. Игрок начинает партию с картой-действием вместо Малыша — нарушено правило Даниила
   «Малыш берётся только из Яслей».
2. 42 карты-действия изъяты из основной колоды (колода 224 вместо 266) и подмешаны в Ясли.
3. `findNeighBlockOwner`/`matchesCardGroup` считают `baby_unicorn` единорогом — карта-действие
   в стойле считается единорогом при подсчёте победы.

## Что сделать (3 точки, все в `server/src/routes/game.ts`)

Флаг в данных: `card.source_zone === 'nursery_only'`. Готовый предикат заводить в
`server/src/engine/` (новый файл либо рядом с `config.ts`), чтобы его читали и routes, и executor:

```ts
// true, если карта живёт только в Яслях (Малыш)
export function isNurseryOnly(card: any): boolean {
  return !!card && String(card.source_zone || '') === 'nursery_only';
}
```

### 1. Основная колода — L131-137 (сборка `shared`)
Сейчас: `if (String(card?.type) === 'baby_unicorn') continue;`
Стало: `if (isNurseryOnly(card)) continue;`
Результат: карты-действия возвращаются в основную колоду, Малыши остаются вне неё.

### 2. Колода Яслей — L148-158 (сборка `nurseryIds`)
Сейчас: `if (String(card?.type) !== 'baby_unicorn') continue;`
Стало: `if (!isNurseryOnly(card)) continue;`
Результат: в Яслях ровно 53 карты-Малыша по признаку данных.

### 3. Раздача стартового Малыша — L192-204
Сейчас: `nursery.findIndex(cid => dict[cid]?.type === 'baby_unicorn')`
Стало: `nursery.findIndex(cid => isNurseryOnly(dict[cid]))`
Служебный фолбэк `c_baby_unicorn_N` (L200-203) оставить как есть — он нужен только если
Ясли исчерпаны; но пометить создаваемую карту `source_zone: 'nursery_only'`, иначе она
не опознаётся как Малыш при возврате в Ясли.

## Критерий приёмки

Команды из `unstable-unicorns-online-new/server`:

1. `node node_modules/jest/bin/jest.js` → EXIT 0, сьютов не меньше baseline (38),
   красных 0; падение любого прежнего теста = регрессия, задача возвращается.
2. `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` → EXIT 0.
3. Живой прогон `node _an_live_nursery3.js` из `D:\CascadeProjects` (сервер пересобран
   и перезапущен): ожидаемо
   - `stable` каждого игрока содержит карту с `source_zone=nursery_only`, тип `baby_unicorn`,
     имя вида «Baby … Unicorn»;
   - `nursery cards WITHOUT flag: 0`;
   - `deck` вырос примерно до 266, `nursery` сократился до ~53 копий;
   - `baby_unicorn type in main deck: 0`.
4. Мутация на выбор Бэкенда: вернуть `type === 'baby_unicorn'` в точке 2 → живой прогон
   обязан снова дать `WITHOUT flag > 0`; вернуть файл по sha256, подтвердить побайтово.

## Границы

- `server/test/**` — Тестировщик: красный тест «в Яслях нет карт без `source_zone=nursery_only`»
  и «стартовый стойл — только `nursery_only`» пишет он, до правки Бэкенда.
- `server/src/**` — Бэкенд.
- `catalog.v2.json`, патч и решения — Аналитик, не трогать.
- Порядок строгий: красный тест → зелёный → живой прогон → мутация.
