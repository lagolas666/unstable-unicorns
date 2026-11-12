# Приёмка BUG-SWAP-04 — транспорт выбора соперника для swap

Дата: 07.11.2026. Исполнитель: Единорог Бэкенд. Статус: **DONE**.

## Что было сломано

После закрытия BUG-SWAP-03 движок (`executor.ts`, `swapOpponentCandidates`) корректно отказывал,
если у swap `destination_player: 'chosen'` несколько кандидатов и выбор не передан. Но транспорт
этот отказ не замечал и не запрашивал выбор:

- `POST /api/game/:id/play` → `gameService.playCard` → `performPlayNow` отвечал **200**: карта
  уходила из руки в сброс, очко действия списывалось, обмена не происходило;
- `POST /api/game/:id/playWithTargets` в `routes/game.ts` — то же самое;
- выбор, переданный клиентом (`targetPlayerId`), на прямом пути (без окна реакции) до исполнителя
  не доезжал вовсе: `executor` читает `ctx.selectedPlayers[sourceCardId]`, а сервис туда не писал.

## Что сделано

`executor.ts` не правился — sha `69237d238c87d4b3…`, 113649 б, 2004 строки (то же состояние, что
после BUG-SWAP-03).

### `server/src/gameService.ts` (+111/−0, sha `73dda42d90d6e010…`, 143031 б, 2384 строки)

1. `CHOSEN_PLAYER_TOKENS` + `collectActionsDeep()` + `swapChoiceRequirement(state, player, card)`.
   Требование выбора распознаётся **по данным каталога** (`destination_player` у действия `swap`),
   сравнений по имени карты нет. Кандидаты — соперники, у которых в зоне назначения есть карты
   (обменять нечего ≠ кандидат). Рекурсия в `choice.options[].actions[]`.
2. Guard в `playCard` — **до** изъятия карты из руки и **до** списания очка действия:
   - кандидатов 0 → 409 `needTargets` (обмен невозможен, карта не сгорает);
   - выбор передан, но не из кандидатов → 400 `invalid`;
   - кандидатов > 1 и выбора нет → 409 `needTargets: true, kind: 'players', options.players`;
   - ровно один кандидат → автоподбор движка, 200.
3. Выбор уходит в окно реакции через `prefill.playerId` — канал, который читает `performPlayNow`.
4. На прямом пути выбор кладётся в `ctx.selectedPlayers[cardId]` — там, где его читает `executor`.
5. Страховка (требование 3): на шину вешается слушатель `action_resolved`; если исполнитель отказал
   на `swap`, а весь розыгрыш карты состоял только из swap — карта возвращается в руку, очко
   действия не тратится, клиент получает 409 с окном выбора. `executor.ts` при этом не тронут.

### `server/src/routes/game.ts` (+20/−2, sha `6d76a9998ee7bcf0…`, 63663 б, 1160 строк)

1. Тот же guard в `playWithTargets`, до изъятия карты.
2. Снесено поле-призрак `pending.preTargetPlayerId` на пути `kind:'play'`: его не читает никто,
   выбор уже в `prefill.playerId`, а `performPlayNow` берёт именно `prefill`.

## Доказательства

### Пробник `server/_be_swap3_transport.js` (вне `server/test/` — доказательством приёмки не является)

```
SUMMARY pass=17 fail=0
PASS T1 отказ 409 при отсутствии выбора соперника :: {"status":409}
PASS T1 needTargets=true в ответе
PASS T1 карта осталась в руке актора :: {"handP1":["dirty_deal_spell","h_p1_a","h_p1_b"]}
PASS T1 очко действия не списано :: {"ap":1,"was":1}
PASS T1 руки соперников не тронуты
PASS T2 статус 200 / карта ушла из руки / обмен p1↔p2 / p3 не тронут
PASS T2 дублей нет :: {"all":["h_p2_a","h_p1_b","h_p1_a","h_p3_a"]}
PASS T2 сумма карт в руках = до − 1 (сгоревшая карта) :: {"after":4,"before":5}
PASS T3 один кандидат (p3 пуст) — 200 без выбора :: {"status":200}
PASS T3 обмен с p2 состоялся
PASS T4 play с окном реакции принят :: {"status":200,"pending":true}
PASS T4 выбор из окна доехал: обмен с p2 состоялся
PASS T4 p3 не тронут после окна
```

T4 нужен, потому что реальной карты «окно реакции + chosen-swap» в каталоге v2 нет:
`dirty_deal_spell` — единственная карта с `destination_player: chosen`, и окно реакции она
не открывает. Поэтому для T4 карта синтетическая (`u_swap_chosen`, тип `basic_unicorn` + on_play
swap), иначе строка проброса выбора через `prefill` осталась бы непроверенной.

### Мутационный прогон `server/_be_swap4_mut.js` (контроль и мутация — разные процессы)

```
ORIG_SHA=73dda42d90d6e010
CONTROL exit=0 fails=0
M1 [guard «выбор соперника обязателен» выключен]        mutSha=1214085abf75acd2 exit=1 fails=5 => CAUGHT
M2 [проброс выбора в ctx.selectedPlayers снят]           mutSha=a95b415dcc3ef42e exit=1 fails=5 => CAUGHT
M3 [кандидатом считается любой соперник без учёта зоны]  mutSha=3b17eeb22bd1e305 exit=1 fails=2 => CAUGHT
M4 [выбор не переносится в окно реакции (prefill)]       mutSha=9610decedca7cc7d exit=1 fails=1 => CAUGHT
RESTORED=true ORIG_UNCHANGED=true
SURVIVED=0
```

M3 сначала выжила: в первом варианте пробника у обоих соперников были карты, и фильтр по зоне
не наблюдался. Добавлен кейс T3 (у p3 пустая рука → единственный кандидат p2), после чего M3
краснеет двумя проверками.

### Полный гейт (`server/_be_fullgate.js`)

```
TSC_EXIT=0
JEST_EXIT=0
Test Suites: 52 passed, 52 total
Tests:       4 skipped, 484 passed, 488 total
FAILED_SUITES=0
SRC_HASH_BEFORE=9cc1ec28ea7af2c8… SRC_HASH_AFTER=9cc1ec28ea7af2c8… SRC_UNCHANGED=true
```

### Гигиена

```
src/gameService.ts    sha=73dda42d90d6e010 bytes=143031 crlf=2384 loneLF=0 FFFD=0 mojibake=0
src/routes/game.ts    sha=6d76a9998ee7bcf0 bytes=63663  crlf=1160 loneLF=0 FFFD=0 mojibake=0
src/engine/executor.ts sha=69237d238c87d4b3 bytes=113649 crlf=2004 loneLF=0 FFFD=0 mojibake=0
```

BOM в `gameService.ts` — существовавший ранее (global #11), этим диффом не привнесён.
Бэкапы для откатов: `src/gameService.ts.prev_swap4` (sha `4d38dcae8eca25b1…`),
`src/routes/game.ts.prev_swap4` (sha `73586ac05b3f39d1…`).

## Что осталось за Тестировщиком (кандидаты в `server/test/`)

1. T-SWAP-T1: `/play` карты `dirty_deal_spell` при 3 игроках без `targetPlayerId` → 409
   `needTargets`, `kind: 'players'`, `options.players` = соперники с картами; карта в руке,
   `action_points` не изменились, руки соперников те же.
2. T-SWAP-T2: 3 игрока, `targetPlayerId: 'p2'` → 200, обмен состоялся, p3 не тронут,
   в руках нет дублей, сумма карт в руках = до − 1.
3. T-SWAP-T3: у одного соперника пустая рука → кандидат один, 200 без явного выбора.
4. T-SWAP-T4: `targetPlayerId` не из кандидатов → 400 `invalid`, мутаций нет.
5. T-SWAP-T5: окно реакции + `chosen`-swap (карта синтетическая, как в пробнике) → выбор из окна
   доезжает до исполнителя.

## Открытые вопросы (не Бэкенд)

1. **Фронтенд/транспорт:** 409 `needTargets, kind:'players', options.players` — клиент должен
   открывать окно выбора соперника и повторять запрос с `targetPlayerId`. Без этого карта
   не сыграется вовсе (тот же вывод, что в `docs/acceptance-bug-swap-03.md`).
2. **Аналитик:** семантика `swapSideOwners` для `all_players` не менялась; автоподбор одного
   соперника — поведение движка, согласовано с BUG-SWAP-03.
3. `playWithTargets` остаётся второй, параллельной реализацией розыгрыша (дублирует сервис).
   Guard стоит в обеих точках, но дублирование — кандидат на слияние отдельной задачей.
4. Страховка `action_resolved` смотрит на события шины глобально по игре; при параллельных
   эффектах слушатель живёт только на время одного `playCard`, конфликтов не наблюдалось,
   но при появлении вложенных розыгрышей это место надо перепроверить.
