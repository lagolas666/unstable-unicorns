# Приёмка filters.subtype: сколько вхождений реально доходит до движка

Дата: 06.11.2026. Автор: Аналитик. Разбор по коду `server/src/engine/executor.ts` + рантайм-пробник.

## Вывод одной строкой

Из 20 вхождений `filters.subtype` в каталоге **до `matchesFilter` в исполнении доходят только 3**, остальные 17 — мёртвые данные. Сьют `subtypeFilters.test.ts` (4 кейса, мутант M4 ловится) закрывает именно эти 3 и остаётся верным, но он создаёт ложное впечатление, что фильтр работает в целом.

## Живые пути (3 вхождения)

| kind | карта | путь |
|---|---|---|
| sacrifice | growth_spell | `matchesFilter` L995, L1018 |
| sacrifice | black_hole_downgrade | `matchesFilter` L995, L1018 |
| search | black_hole_downgrade | `matchesFilter` L1640, L1656 |

Дополнительно `matchesFilter` с фильтром целиком зовут ещё две ветки, у которых сейчас нет вхождений `subtype` в каталоге: `destroy` (L893), `reveal` (L1266, L1278), `mill_until` (L1765). То есть механизм живой в 5 kind, а данных `subtype` под него — три штуки.

## Мёртвые пути (17 вхождений)

| kind | вхождений | почему мёртв |
|---|---|---|
| pull | 6 | `executePull(ctx, player)` вызывается без селектора (L849 → L653-663), `filters` не читается |
| prevent | 2 | нет `case 'prevent'` в `executeAction`; в `gameService.ts` L1447 это только запись лога реакции |
| add | 2 | L938-955: берётся `srcArr.pop()`, селектор `target` не читается вообще |
| move | 1 | L1044 читается только `filters.card_group` |
| return / transfer | 1 | L1126 читается только `filters.card_group` |
| steal | 1 | L1294 + `matchesCardGroup` L1310, только `card_group` |
| conditional_loop | 1 | нет `case` в `executeAction` (nymph_unicorn_magic) |
| play_requirements.conditions | 2 | не исполняется вовсе (известный пункт, rainbow_mane_upgrade, extra_tail_upgrade) |
| условие effects[].condition | 1 | imaginary_friendicorn_upgrade, условие не вычисляется движком |

## Доказательство рантаймом (пробник, снят после прогона)

- P5 `move`: фильтр `subtype: ultimate`, верх стойла — `basic`. Уехал **basic**. `ФИЛЬТР_ИГНОРИРУЕТСЯ=true`
- P6 `steal`: фильтр `subtype: ultimate`, верх стойла соперника — `basic`. Украден **basic**. `ФИЛЬТР_ИГНОРИРУЕТСЯ=true`
- P7 `return`: `ok=false`, карта не перемещена — отдельный дефект, разбор ниже
- P8 контроль `sacrifice`: фильтр `subtype: ultimate`, верх — `basic`. В сброс ушёл **ultimate**. `ФИЛЬТР_РАБОТАЕТ=true`
- P1 `pull`, P2 `add`: селектор с фильтром не читается, действие прошло по своей логике

## Побочный дефект, найденный пробником

`return`/`transfer` вернул `ok=false` при легальной фикстуре (в сбросе две карты, цель в `from` с `scope: 'self'`). Причина — `isActionPossible` L463 считает `countAvailableTargets(action.from)`, а это путь против `destroy`-семантики; в `executeAction` L1120-1140 ветка ждёт иное. Требует отдельного разбора, в этот дифф не входит.

## Что делать (предложение Бэкенду)

Один резолвер целей вместо `filters.card_group` в каждой ветке: `resolveTargetCards(ctx, player, selector)` → массив id, внутри один вызов `matchesFilter`. Переводить по одной ветке, начиная с `pull` (6 карт — самый крупный выигрыш), затем `add`, `steal`, `move`, `return`. Тесты — на каждую переведённую ветку, красный обязан быть при мутанте «фильтр игнорируется» в этой конкретной ветке.
