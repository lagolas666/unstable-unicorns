# QA-отчёт: swap (`dirty_deal_spell`, «Нечестная сделка»)

Дата: 07.11.2026. Тестировщик. Основание: DONE Бэкенда от 06–07.11.2026 (закрытие D5/swap, sha `executor.ts` `77524fc9fb0c97ca…`).

## Что проверялось

Действие `swap` — единственное в каталоге v2 (`data/catalog.v2.json`, карта `dirty_deal_spell`, md 37).
Текст карты: «Поменяйтесь всеми картами на руке с картами на руке другого игрока».
Каталог: `target {scope:'self', zone:'hand', filters:{card_group:'any'}, quantity:{value:99}}`,
`destination_player:'chosen'`, `destination:'hand'`.

## Созданный файл

`server/test/swap.test.ts` — 8749 б, CRLF 173, loneLF=0, U+FFFD=0, sha256 `ba3191192b0a0143…`.
Пять кейсов, фикстуры из `catalog.v2.json` как есть (`apprentice_unicorn`, `rainbow_aura_upgrade`,
`angelic_baby_unicorn`, `lucky_streak_spell`), колода в `makeState` непустая.

| Кейс | Сценарий | Статус |
|---|---|---|
| S1 | по одной карте у каждого — обмен состоялся | зелёный |
| S2 | по две карты — меняются наборы целиком | КРАСНЫЙ |
| S3 | легаси-диалект `.a`/`.b` исполняется | КРАСНЫЙ |
| S4 | одна и та же карта выбрана дважды — `false` без мутаций | зелёный |
| S5 | у соперника пустая рука — `false` | зелёный |

## Баги

### BUG-SWAP-01 (High): легаси-диалект `.a`/`.b` отсекается предпроверкой

**Шаги:**
1. Взять действие `swap` из `dirty_deal_spell`, снять `.target`/`.destination`/`.destination_player`.
2. Записать селекторы в `.a` (`self`/`hand`) и `.b` (`opponent`/`hand`) — форма, которую движок читал до правки D5.
3. `resolveActions(ctx, p1, [action])`.

**Ожидаемое:** `ok=true`, руки p1/p2 обменялись (заявлено в DONE: «легаси-форма с явными `.a`/`.b` работает как раньше»).
**Фактическое:** `ok=false`, зоны не тронуты. Причина: `isActionPossible` (executor.ts L461–466) для `move/steal/give/swap/return` читает только `actionSelector` (`.from ?? .source ?? .target ?? .targets`), `.a`/`.b` он не знает и возвращает `false` до `executeAction`; ветвь `case 'swap'` (L1230–1237) легаси при этом поддерживает.
**Серьёзность:** High — расхождение с заявлением о сдаче; легаси-импорт (`seedCards`/`import`) потеряет обмен.

### BUG-SWAP-02 (High): `quantity` не исполняется, обмен идёт внутри своей руки

**Шаги:**
1. p1 рука `[apprentice_unicorn, rainbow_aura_upgrade]`, p2 `[angelic_baby_unicorn, lucky_streak_spell]`.
2. Разыграть `swap` из `dirty_deal_spell` без явного выбора (`selectedTargets` пуст).

**Ожидаемое:** по тексту карты — полный обмен руками: у p1 `[angelic_baby, lucky_streak]`, у p2 `[apprentice, rainbow_aura]`.
**Фактическое:** `ok=true`, p1 `[rainbow_aura, apprentice]` (перестановка своих же карт), p2 не изменился.

**Разбор:** `actionDestination` при `destination_player:'chosen'` отдаёт `{scope:'any_player', zone:'hand'}`,
а `getScopePlayers` (L588–591) для `any_player` возвращает `ctx.state.players` — **включая актора**.
`pickFromSelector(b, aid)` обходит владельцев в порядке массива, у p1 находит подходящую карту и делает `splice`
в том же массиве, откуда взят `aid`. Итог — перестановка двух своих карт, `aid !== bid`, поэтому guard
`aid === bid → false` не срабатывает: это третий случай «успеха без эффекта», не закрытый правкой.
`quantity.value = 99` не читается вовсе — обмен всегда по одной карте.
**Серьёзность:** High — единственная карта класса «обмен руками» не выполняет свой текст.

## Дефект, закрытый Бэкендом (подтверждён)

`TypeError: Cannot read properties of undefined (reading 'zone')` больше не воспроизводится: пробник на
`dirty_deal_spell` проходит, `ok=true`, при равных руках обмен реагирует на карты (`S1`). Падение до правки
подтверждено Бэкендом на sha до `77524fc9…`.

## Гейт и доказательства

- Полный гейт (`node _be_fullgate.js`): `TSC_EXIT=0`, `JEST_EXIT=1`,
  **52 сьюта / 488 тестов / 482 passed / 4 skipped / 2 failed**, красные только `test/swap.test.ts` S2 и S3.
  До сьюта было 51/483/479/4 — регрессий в чужих сьютах нет.
- `SRC_HASH_BEFORE = SRC_HASH_AFTER = 0745773982b7…`, `SRC_UNCHANGED=true` — `src/**` не тронут.
- Невакуумность S1: мутация `_te_swap_mut.js` убирает `aArr.splice(ai, 1, bid)` (anchor hits=1) →
  `MUT_EXIT=1`, красный ровно S1 (плюс уже красные S2/S3), откат `BYTE_IDENTICAL=true`,
  `RESTORED_SHA=77524fc9…`, размер совпал.

## Поправка к прошлому STATUS

Строка «рука соперника пуста → `ok=true`» в моём предыдущем сообщении неверна: пробник даёт `ok=false`
(кейс S5 зелёный). Остальные четыре строки подтверждены повторно.

## Что не проверено

- Поведение `swap` в живом прогоне через REST/сокет (`routes/game.ts` → `gameService.playCard`) — не гонял.
- Явный выбор получателя через окно `needTargetPlayer`: `destination_player:'chosen'` в предпроверке
  не влияет на выбор владельца, живой вход не проверен.
- `quantity` для `swap` — значения кроме 99 в каталоге отсутствуют, поведение не исследовано.

## Требования к Бэкенду

1. `isActionPossible` для `swap` — на том же селекторе, что и ветвь: учитывать `.a`/`.b` (BUG-SWAP-01).
2. `getScopePlayers` для `any_player` в `swap` — исключать актора либо брать получателя из
   `destination_player`/явного выбора (BUG-SWAP-02).
3. Читать `quantity.value` для `swap` и менять наборы целиком (BUG-SWAP-02).
4. `ok=true` при неизменных зонах — запрещён: либо мутация, либо `false`.

Приёмка: S1–S5 зелёные без правки `swap.test.ts`, полный гейт не хуже 52/488/487/4/0, `SRC_HASH` до/после мутаций идентичен.
