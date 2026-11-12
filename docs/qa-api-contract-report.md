# QA-отчёт: контракт API (server/test/apiContract.test.ts)

**Дата:** 11.11.2026
**Задача:** тест контракта по `docs/API_CONTRACT.md` (обновление 11.11.2026)
**Автор:** Единорог Тестировщик
**Статус:** DONE

---

## 1. Что сделано

Создан файл `server/test/apiContract.test.ts` — 17 тестов, CRLF, 17476 байт, 419 строк,
`loneLF=0`, `U+FFFD=0`, BOM=false.

Метод: контракт не просто переписан в тест. Сначала пробником
(`server/_te_contract_probe.js`) сняты **реальные** тела ответов живого Express-приложения
с монтированным `routes/game.ts`, и тест утверждает то, что сервер отдаёт фактически.
Там, где документ расходится с кодом, в тесте стоит комментарий `РАСХОЖДЕНИЕ D-n`.

## 2. Покрытие

### REST `POST /api/game/:id/play` (8 тестов)
| Сценарий | Ожидание | Код |
|---|---|---|
| успешный розыгрыш | 200, голый `GameState` | 200 |
| карта не в руке | 400 `Card not in hand`, без `code` | 400 |
| не та фаза | 400 `Not in action phase` | 400 |
| downgrade без `targetPlayerId` | 409 + `needTargetPlayer`, `kind`, `options.players` | 409 |
| партия окончена | 409 `gameOver:true` + `winnerId` | 409 |
| неизвестная игра | 404 `Game not found` | 404 |
| карта с `on_play` destroy | 200 `{pending, state}`, `pending.kind='play'` | 200 |
| swap без кандидатов | 409 `noSwapCandidates`, без `needTargets` | 409 |

### REST `POST /api/game/:id/endTurn` (3 теста)
- обычный конец хода → 200, голый state, ход уходит к `p2`, `pending` отсутствует;
- рука 8 → 200 `{pending, state}`: `kind='await_choice'`, `purpose='hand_limit'`,
  `chooserId='p1'`, `remaining=1`, рука всё ещё 8, автосброса нет;
- партия окончена → 409 с `gameOver` на верхнем уровне.

### Socket ack (5 тестов)
- `join_game` успех: ровно `["logs","ok","pending","state"]`, `pending=null`;
- `join_game` неизвестная игра → `GAME_NOT_FOUND`;
- `play_card` без `playerId` → `BAD_REQUEST`;
- `play_card` успех → `ok:true` + `state`;
- форма union `SocketErrorCode`.

### Union кодов ошибок (1 тест)
Коды собираются из реальных ack за прогон (`ack()` пишет их в `observedCodes`), затем
проверяется принадлежность каждого к union из 7 значений и невакуумность (`size >= 2`).

**Итого: 8 + 3 + 5 + 1 = 17 тестов.**

## 3. Найденные расхождения документа с кодом

Это не баги реализации — это баги **документа**: `docs/API_CONTRACT.md` обещает фронтенду
шейпы, которых сервер не отдаёт. Фронтенд, написанный по документу, будет читать
`undefined`.

### D-1 — обёртка успеха `/play` (High для фронтенда)
Документ (1.1): `{ success: true, extra: { state: GameState } }`.
Код (`routes/game.ts` L934-935): отдаёт **голый** `GameState`, а при открытом окне —
`{ pending, state }`. Поля `success` и `extra` не существуют ни в одном ответе.

### D-2 — поле `code` в ошибках REST (High для фронтенда)
Документ (1.1, 1.3): 409 с `code: "WRONG_PHASE" | "CARD_NOT_IN_HAND" | ...`.
Код: тела ошибок — `{ message, ...extra }`, поля `code` нет вообще; кроме того ряд отказов
отдаёт 400, а документ обещает 409.

### D-3 — `needTargets` против `needTargetPlayer` (High для фронтенда)
Документ: `extra.needTargets: true`, `extra.kind`, `extra.options: string[]`.
Код: `needTargetPlayer: true`, `kind`, `options: { players: [...] }` — **в корне тела**,
не в `extra`, имя флага другое, `options` не массив строк, а объект.
(Задача Аналитика от 11.11.2026 требовала «фиксировать как есть» — зафиксировано.)

### D-4 — `GAME_OVER` не используется (Medium)
Документ (4.2): код `GAME_OVER` с `extra: { gameOver, winnerId }`.
Код (`gameService.ts` L592): отдаёт `WRONG_PHASE` + `gameOver`/`winnerId`.
Именно этот факт был предупреждён в задаче и подтверждён пробником.

### D-5 — форма `PendingAction` (High для фронтенда)
Документ (раздел 3): `type`, `playerId`, `options`, `remaining`, `done`, `purpose`, `timeout`.
Код: `kind`, `actorId`, `chooserId`, `sourceCardId`, `options`, `remaining`, `done`,
`expiresAt` (epoch-мс), `prefill`. Поля `type`, `playerId`, `timeout` отсутствуют.

### D-6 — union кодов ошибок (Medium)
Документ (4.1): 12 кодов. Реально существуют 7:
`BAD_REQUEST`, `CARD_NOT_IN_HAND`, `GAME_NOT_FOUND`, `NOT_YOUR_TURN`,
`NO_ACTION_POINTS`, `PENDING_ACTION`, `WRONG_PHASE`.
Восемь заявленных кодов не существуют: `GAME_OVER`, `HAND_LIMIT`, `NEIGH_WINDOW`,
`NO_VALID_TARGETS`, `NO_SWAP_CANDIDATES`, `TARGET_IMMUNE`, `UNKNOWN_CARD`,
`INTERNAL_ERROR`. Два реальных кода не задокументированы: `GAME_NOT_FOUND`,
`NO_ACTION_POINTS`.
Внимание: документ противоречит сам себе в 4.3 — упоминает `HAND_OVER_LIMIT` и
`NEED_TARGETS`, которых нет ни в списке 4.1, ни в коде.

### D-7 — `GameState` не совпадает с документом (High для фронтенда)
Документ (раздел 3): `id`, `turn.current` (индекс), `turn.phase: Beginning|Draw|Action|End`,
`gameOver`, `logs`, `players[].name`, `players[].nursery`, `cards`.
Код (`engine/state.ts` L34-58): `turn.currentPlayerId` (строка), `turn.phase` =
`begin_turn|draw|action|end_turn`, поля `gameOver`, `logs`, `id` **отсутствуют**;
у игрока `action_points`, а не `name`; `nursery` — общий массив на стейте.
Расхождения по регистру фаз и по отсутствию `gameOver` особенно опасны: фронтенд
не узнает о конце партии из `state`, только из отдельного события.

## 4. Доказательство невакуумности

Четыре мутации `src`, откаты `BYTE_IDENTICAL`:

| Мутация | Файл / анкер | Результат |
|---|---|---|
| M1 `400 → 409` | `gameService.ts` `return fail('CARD_NOT_IN_HAND', 'Card not in hand', 400);` | RED: «карта не в руке», 16/17 — EXACT |
| M2 `noSwapCandidates: true → false` | `gameService.ts` `{ noSwapCandidates: true }` | RED: «swap без кандидатов», 16/17 — EXACT |
| M3 `{pending, state} → {state}` | `routes/game.ts` `if (pending) return res.json({ pending, state });` | RED: «рука 8», 16/17 — EXACT |
| M4 код отказа → `WRONG_PHASE_X` | `gameService.ts` `fail('WRONG_PHASE', 'Game is over', …)` | RED: 2 теста — socket «партия окончена» + union |

Анкеры: `hits=1` у каждого. Откат: `sha gameService=7dafa3ef61236343`,
`routes=266a6b9774bcbc18` до и после.

**M4 — отдельная находка.** Первый заход M4 не покраснел вообще. Причина: код ошибки из
`gameService` не доезжает до REST-ответа (см. D-2 — поля `code` в теле 400/404/409 нет),
поэтому union проверялся только на socket-пути. Добавлен socket-кейс
`play_card на оконченной партии → code WRONG_PHASE`, после чего M4 краснит два теста,
проверяющих одно и то же правило: код отказа обязан входить в union. Это калибровка
мутации, а не разброс — оба красных падают на проверяемом правиле.

### Что D-6 доказывает теперь
Тест не сравнивает два хардкода. Обёртка `ack()` запоминает каждый код, реально пришедший
в ack за прогон; последний тест требует, чтобы `observedCodes.size >= 2` (иначе проверка
вакуумна) и чтобы каждый наблюдённый код входил в union из 7 значений.
Список 7 кодов сверен с `handlers.ts` L32-39 и `gameService.ts` L559-566 — оба union
идентичны, что проверено чтением файлов, а не памятью.

## 5. Гейт

```
SRC_HASH_BEFORE=4856ce74d32c780a
TSC_EXIT=0
JEST_EXIT=0
SUITES total=56 passed=56 failed=0
TESTS  total=518 passed=514 failed=0 skipped=4
SRC_HASH_AFTER=4856ce74d32c780a
SRC_UNCHANGED=true
```

Было 55 сьютов / 501 тест. Прирост: +1 сьют / +17 тестов, ни одной регрессии.

## 6. Что не покрыто

- `POST /playWithTargets` (документ 1.2) — отдельный сьют, в этой задаче не запрашивался;
- `POST /resolvePending` (документ 1.5) — покрыт `archangelWindow.test.ts`,
  `bug01HandLimitTimer.test.ts`;
- socket-события `reaction`, `chat_message`, broadcast `state_update`/`pending_update`/
  `logs_update`/`game_over` (документ 2.2) — не проверялись: broadcast требует
  перехвата `io.to().emit`, в FakeIo он заглушён;
- поля `scopeUnresolved` и `optionalSkipped` в телах ошибок — не встретились ни в одном
  сценарии, форма не подтверждена.

## 7. Требуется решение Аналитика

Документ `docs/API_CONTRACT.md` описывает API, которого нет. Приоритет правки:
сначала D-7 и D-1 (фронтенд читает `state` и тело ответа первым делом), затем D-3 и D-5
(окна выбора), затем D-2, D-4, D-6.
Вопрос: правится документ под код или код под документ — это меняет объём работы
Фронтенда. Пока решение не принято, тест фиксирует поведение кода, чтобы рефакторинг
не ломал его незаметно.

## 8. Временные файлы (не удалены, нужно разрешение)

`server/_te_contract_probe.js`, `server/_te_probe_out.txt`, `server/_te_probe_err.txt`,
`_te_run_contract.js`, `_te_mutate_contract.js`, `_te_anchor_hits.js`, `_te_find_anchors.js`,
`_te_enc_check.js`, `_te_crlf.js`, `_te_gate_full.js`, `_te_read_*.js`, `_te_routes_*.js`,
`_te_gate_out.txt`, `_te_mut_out.txt`, `_te_jest_contract.json`, `_te_mut.json`,
`_te_gate_full.json`.
