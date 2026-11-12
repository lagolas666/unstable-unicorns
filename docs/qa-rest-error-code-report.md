# QA: D-2 — поле `code` в телах REST-ошибок

**Дата:** 11.11.2026
**Задача:** зафиксировать точные значения `code` в lowercase snake_case по согласованному формату Бэкенда.
**Файл тестов:** `server/test/restErrorCode.test.ts` (9 it, 6013 б, CRLF 120, loneLF=0, U+FFFD=0, sha256 `48f9886e3d9d7dce…`)
**Зона:** `server/test/**` — исходники `server/src/**` не тронуты (`SRC_HASH` до/после `956337a8cc389a50`, 39 файлов, IDENTICAL).

---

## 1. Согласованный формат

lowercase snake_case. Трансляция `ServiceErrorCode` (`server/src/gameService.ts:559`) → значение в теле REST:

| ServiceErrorCode | значение в теле |
|---|---|
| `GAME_NOT_FOUND` | `game_not_found` |
| `NOT_YOUR_TURN` | `not_your_turn` |
| `CARD_NOT_IN_HAND` | `card_not_in_hand` |
| `WRONG_PHASE` | `wrong_phase` |
| `NO_ACTION_POINTS` | `no_action_points` |
| `BAD_REQUEST` | `bad_request` |
| `PENDING_ACTION` | `pending_action` |
| _нет_ — ветка без `fail()` | `nothing_pending` (решение Аналитика 11.11.2026) |

Guard-путь `routes/game.ts` уже пишет в этом формате (`game_not_found`, `not_in_action_phase`, `discard_not_in_action_or_end_turn`, `no_opponent_can_swap_cards`), поэтому формат согласован с существующим кодом, а не изобретён.

## 2. Кейсы и статус

| # | Кейс | Ожидание | Источник ошибки | Сейчас |
|---|---|---|---|---|
| R01 | `draw` несуществующей игры | 404 `code=game_not_found` | guard `routes/game.ts:392` | PASS (контроль) |
| R02 | `POST /api/game` с 1 игроком | 400 `code=need_at_least_2_players` | guard `:72` | PASS (контроль) |
| R03 | `endTurn` после победы | 409 `code=game_is_over` + `gameOver` + `winnerId` | guard `:59` | PASS (контроль) |
| **R04** | `draw` чужим `playerId` | 400 `code=not_your_turn` | `gameService.ts:613` `fail()` | **FAIL — RED** |
| **R05** | `play` карты не из руки | 400 `code=card_not_in_hand` | `gameService.ts:629` `fail()` | **FAIL — RED** |
| **R06** | `play` не в action-фазе | 400 `code=wrong_phase` | `gameService.ts:619` `fail()` | **FAIL — RED** |
| **R07** | `resolvePending` без окна | 400 `code=nothing_pending` | `gameService.ts:2252`, ответ напрямую | **FAIL — RED** |
| R08 | `discard` в неверной фазе | 400 `code=discard_not_in_action_or_end_turn` | guard `:1013` | PASS (контроль) |
| R09 | успешный `draw` | 200 без поля `code` | — | PASS (контроль) |

Красные падают **именно на `code`** (`Expected: "not_your_turn" / Received: undefined`, строки 70/79/88/98), проверки `status` и `message` в тех же кейсах проходят. Фактические тела с живого Express подтверждают ожидания по `message`:

```
R04 draw p2          -> 400 keys=["message"] {"message":"Not your turn"}
R05 play zzz         -> 400 keys=["message"] {"message":"Card not in hand"}
R06 play h1          -> 400 keys=["message"] {"message":"Not in action phase"}
R07 resolvePending   -> 400 keys=["message"] {"message":"Nothing pending"}
```

## 3. Корень дефекта

`ServiceError` несёт `code` (`gameService.ts:568-571`), но транспорт его выбрасывает:

```ts
// routes/game.ts:919-922 (play), :396-400 (draw), :942-946 (endTurn)
const payload: any = { message: result.message };
if (result.extra) Object.assign(payload, result.extra);
return res.status(result.http).json(payload);
```

Нужен `code: String(result.code).toLowerCase()` в payload во всех трёх ветках. У R07 отдельная причина: `resolvePendingNow` отвечает на `:2252` напрямую, минуя `fail()`, — там `code` надо проставить вручную.

## 4. Мутации (откаты BYTE_IDENTICAL)

`src/routes/game.ts` sha до/после `612d09a64d84a2aa`.

| Мутация | Что сделано | Результат |
|---|---|---|
| M1 | в payload `/play` добавлен `code` | R05, R06 → PASS; R04, R07 остались RED ⇒ красные именно про отсутствие `code` на этих путях |
| M2 | `game_not_found` → `game_not_found_mut` (первый guard файла) | **промах**: R01 не покраснел, попал в чужой guard — мутация невалидна |
| M2b | то же в guard роута `draw` (`:392`) | R01 → FAIL ⇒ зелёные контроли невакуумные |

## 5. Гейт

```
SUITES=58 TESTS=535 PASSED=527 FAILED=4 SKIPPED=4   JEST_EXIT=1
FAILED_SUITE: restErrorCode.test.ts (только R04–R07)
TSC_EXIT=0
SRC_HASH_BEFORE=956337a8cc389a50 files=39
SRC_HASH_AFTER =956337a8cc389a50 files=39   IDENTICAL
```

Прежний baseline был 534 теста / 526 passed; +1 тест (R09) — мой. Регрессий нет.

## 6. Открытые вопросы Бэкенду

1. **R07 — решено.** Аналитик 11.11.2026 утвердил `nothing_pending` (ветка не проходит через `fail()`, `pending_action` означало бы «есть мешающее окно»). Ожидание в тесте обновлено, адресный RED подтверждён: R07 падает на `code`, `status` и `message` зелёные.
2. **`playWithTargets`** (`:1033-1046`) и остальные 4xx-ветки сервиса не покрыты отдельными тестами: они разделяют тот же payload-механизм, но проверены косвенно через R05/R06.
3. **5xx** не покрыт — воспроизвести без мусора в `src/**` не удалось.
4. Ветки `routes/game.ts`, где `result.extra` нет вовсе (например `:987`), возвращают `{ message }` без `code` — это guard'ы, а не сервис, к D-2 не относятся, но при унификации стоит учесть.

## 7. Временные файлы

`server/_te_d2_{r09,probe,patch_r09,why,mut,mut2,gate,unit}.js/json/log` — ждут разрешения на удаление.

## Итог D-2 (11.11.2026): закрыто

- `server/test/socket.test.ts` S19 — ожидание `ack.code === 'nothing_pending'` (было `BAD_REQUEST`); ключ подтверждён правкой `gameService.ts` L2252.
- `server/test/apiContract.test.ts` L205-213 — ожидание `res.body.code === 'card_not_in_hand'` (было `toBeUndefined()`).
- Гейт: 58 сьютов / 535 тестов / 531 passed / 0 failed / 4 skipped, JEST_EXIT=0, TSC_EXIT=0, хэш `server/src/**` 3a0c0e2eedb16a9d до и после — IDENTICAL.
- Мутация M-D2-S19 (`nothing_pending` -> `BAD_REQUEST` в gameService.ts L2252, anchor hits=1) краснит ровно 2 теста на одном правиле: socket S19 и restErrorCode R07; откат BYTE_IDENTICAL, sha 9201445330f8acd7.
- `socket.test.ts`: 42177 б, LF 1003, CR 0, U+FFFD 0, sha 22245bab1af7556d.

## Открытый вопрос к Бэкенду (D-2 не блокирует)

`ackFromOutcome` (`handlers.ts` L114-128) кастует `outcome.body.code` в `SocketErrorCode` без проверки, а union L32-39 содержит только 7 кодов в верхнем регистре — `nothing_pending` (нижний регистр) в него не входит. Тип расходится с реальностью: ack несёт значение вне union. Зона тестировщика это не чинит.
