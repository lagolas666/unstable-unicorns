# D5: селектор действия `.target` против `.from`/`.source` — подтверждён

Дата: 06.11.2026. Автор: Единорог Тестировщик. Файл сьюта: `server/test/resolverFilters.test.ts`.

## Вердикт

**D5 — дефект, подтверждён.** Причина красного — имя ключа, не значение фильтра.
Все 65 действий переноса в `catalog.v2.json` кладут селектор в `.target`, движок читает `.from`/`.source`.

## Что прочитано по коду (executor.ts, 1853 строки)

| Строка | Что делает | Значение для D5 |
|---|---|---|
| L479–483 `normalizeActionTargets` | только `target → targets` | `.from`/`.source` **не создаются никогда** |
| L463 `isActionPossible` | `return (action as any)?.from ? countAvailableTargets(...) : false` | нет `.from` → `false` → действие выпадает |
| L1041 `case 'move'` | `const from = (action as any).from` | читает несуществующий ключ |
| L1123 `case 'give'/'return'/'transfer'` | `const from = (action as any).from` | то же |
| L941–942 `case 'add'` | `action.source` / `action.destination` | то же, другой диалект |
| L653–663 `executePull` | `selectedPlayers`, случайная карта из руки | `target` не читает вовсе |
| L552–553 `getScopePlayers` | нет селектора → `[player]` | Тихо деградирует в актора, отказа не будет |

## Что прочитано по данным (скан всех 329 карт каталога, `_te_sel_shapes.js`)

Форма селектора по видам — ключа `from` нет **ни у одного** действия:

```
return         total=9   target,destination=7          target=2
move           total=19  target,destination=19
pull           total=6   target,destination=6
return_to_hand total=6   target=6
steal          total=18  target=11                     target,destination=7
add            total=3   target,destination=3
give           total=3   target,destination=3
swap           total=1   target,destination=1
```

Итого 65 действий, `.from` = 0 вхождений. Форма данных: `target` + `destination`.

## Доказательство красного (не по чужой причине)

`node _te_run_json.js test/resolverFilters.test.ts`, JEST_EXIT=1:

```
[failed] D5-a: move с настоящим .target обязан исполниться и переставить карту
  - Expected  - 3        + Received  + 3
    Object {
  -   "discard": Array [],
  -   "ok": true,
  -   "stable": Array [
  +   "discard": Array [
        "apprentice_unicorn",
      ],
  +   "ok": false,
  +   "stable": Array [],
[pending] RF-7 (skip)
```

`ok: false`, сброс не тронут, стойло пусто → действие отсеклось на предпроверке L463.
Фикстура гарантирует, что цель в сбросе **есть** (ассерт фикстуры + вызов получил тот же объект карты,
что лежит в `state.cards`), поэтому красный не может быть «цель не найдена».

## Доказательство, что красный — от ключа (мутация M-D5)

`_te_mut_d5.js --apply`: в `normalizeActionTargets` добавлено `action.from = action.target` и
`action.to = { scope, zone: action.destination }`. Ничего больше не менялось.

```
anchor hits=1
applied, sha_before=3d50514aed27de2736109180e94a4e199453bbc888c9c2f3839ce222c6bbb840
```

Результат прогона:

```
numTotalTests=3 passed=2 failed=0 skipped=1 suitesFailed=0
   [passed] D5-a ...   [passed] D5-b контроль ...   [pending] RF-7
JEST_EXIT=0
```

Откат: `_te_mut_d5.js --revert` → `BYTE_IDENTICAL=true`, `sha_after=3d50514aed27de2736109180e94a4e199453bbc888c9c2f3839ce222c6bbb840`.
Повторный прогон на чистом коде снова красный (JEST_EXIT=1) — доказательство, что зелёное было от мутации, а не от кэша.

## Контроль (не проверка дефекта)

`D5-b`: то же действие, тот же селектор, та же карта в том же сбросе, отличие **одно** — имя ключа
(`from`/`to` вместо `target`/`destination`). Зелёный. Значит путь `move` рабочий, а красный D5-a даёт
несовпадение имени ключа. После починки контроль обязан остаться зелёным — он сторожит обратную
совместимость `action.from ?? action.target`.

## Дополнительно найдено в той же ветви (по коду, тестом пока не закрыто)

`case 'give'/'return'/'transfer'`, L1141: `const destZone = (to as any)?.zone ?? 'stable';`
Ключ `destination` из каталога не читается, а `to` нет ни у одной карты → любое `return` кладёт карту
в **стойло**, даже когда данные говорят `destination: "hand"`.

Пострадавшие по данным (все 9 `return`):

```
mermaid_unicorn_magic          -> destination hand
7 карт                          -> destination hand  (target,destination)
2 карты                         -> без destination
```

Это отдельный дефект от D5: он останется даже после починки `.from`, потому что адресат по-прежнему
берётся из несуществующего `to`. Отнести к фазе D3 (`return`), кейс оформить там.

## Влияние на гейт

Добавлен 1 файл сьюта, +3 теста (1 красный до починки, 1 зелёный контроль, 1 skip).
Ожидаемый гейт: **51 сьют / 483 теста / 479 passed / 1 failed / 3 skipped**, `JEST_EXIT=1`
до правки Бэкенда. Красный намеренный и единственный; после правки `executor.ts` сьют обязан позеленеть
**без изменения теста** — это условие приёмки.

## Просьба к Бэкенду

Не чинить `normalizeActionTargets` дописыванием `.from` (в мутации это сработало, но сохраняет два
диалекта в данных). Правильнее — единый `actionSelector(a) = a.from ?? a.source ?? a.target ?? a.targets`,
`.to` аналогично `a.to ?? a.destination`, и `isActionPossible` L463 переводится на тот же `actionSelector`.
Иначе предпроверка и исполнение снова разойдутся.
