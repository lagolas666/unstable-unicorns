# DEF-07 закрыт: окно await_choice доходит до клиента

Дата приёмки: 31.10.2026. Исполнитель правки: Единорог Аналитик (зона Бэкенда освобождена).

## Дефект

Окно выбора карты защитником (`kind: 'await_choice'`) открывается **внутри** резолва розыгрыша:
`triggerEnterEffectsFor` → `ctx.requestChoice` пишет окно в стор игры. Но `playCard` собирал
outcome без поля `pending` (gameService.ts L721), поэтому транспорты
(`server/src/socket/handlers.ts` L186-190 и `server/src/routes/game.ts` L891-897) видели
`result.pending === undefined`, уходили в ветку `state_update`, и клиент окно не получал.

Живое доказательство до фикса (`_an_live_await46.js`): `store.pending.kind='await_choice'`,
`ack.pending=undefined`, p2 получил `['state_update','logs_update']`.

## Правка

Один файл: `server/src/gameService.ts`, строка исхода обычного розыгрыша.

```ts
return { ok: true, state, logs: entry.logs, pending: (entry.pending as any) || undefined, openedWindow: false };
```

`openedWindow` намеренно не менялся: это признак окна, открытого **до** резолва
(два теста держат это поведение — `playContract.test.ts` P6/P9, `enterHook.test.ts` L170).

Файл: 122405 б / 2066 строк, CRLF (crlf=2066, loneLF=0), U+FFFD=0.
sha256 до правки: `9457ab2e…49972877`, после: `d3b43df0…a3205801`.

## Доказательства

Страж `server/test/defect07PendingOutcome.test.ts` (103 строки, 2 теста):

```
PASS test/defect07PendingOutcome.test.ts
Tests: 28 passed, 28 total   (defect07 + awaitChoiceGuard + enterHook + drawExecutor)
```

Живой socket-прогон `_an_live_await46.js` (реальный сервер, два сокета, Puppetmaster):

```
PASS p2 получил pending_update с kind=await_choice
PASS chooserId === p2 (защитник)
PASS options = рука защитника
PASS актор не закрывает окно защитника (guard владельца)
PASS окно закрылось (pending null)
PASS карта вне options отвергнута
RESULT ok=22 bad=0 total=22
```

Мутация AN-D07-M1 (`pending: undefined` в исходе) — hits=1, красный ровно D1:

```
× D1: playCard отдаёт pending=await_choice, если окно открылось в enter-хуке
expect(received).toBeTruthy()  Received: undefined
Tests: 1 failed, 1 passed
```

Файл после мутации возвращён побайтово: sha256 `d3b43df0…a3205801` совпал.

Гейты:

```
server: Test Suites: 29 passed, 29 total
        Tests: 3 skipped, 353 passed, 356 total      JEST_EXIT=0
        tsc --noEmit                                  TSC_EXIT=0 (вывод пустой)
client: tsc --noEmit                                  TSC_CLIENT_EXIT=0
        vite build — ✓ built in 4.48s                 VITE_EXIT=0
```

Baseline в памяти был 28 сьютов / 354 / 351 passed / 3 skipped — это был baseline **до**
стража DEF-07. С ним: 29 сьютов, 356 total, 353 passed. Прирост ровно +1 сьют и +2 теста
(D1, D2), регрессий нет. Новый baseline: **29 сьютов / 356 total / 353 passed / 3 skipped,
JEST_EXIT=0, TSC_EXIT=0**.

## Клиентская часть (проверена, не менялась)

- `client/src/types/socket.ts` — `ResolvePendingPayload { gameId, playerId, cardId? }`
- `client/src/hooks/useSocket.ts` L214-224 — `resolvePending(extra?: { cardId? })`, пустой cardId не отправляется
- `client/src/pages/GameRoom.tsx` L177-186, L347-355 — `onPickAwaitChoice` → `resolvePending({ cardId })`, `AwaitChoiceModal` получает `pending`, `mePlayerId`, `state`
- `client/src/components/AwaitChoiceModal.tsx` (119 строк) — открывается только при `chooserId === mePlayerId`, варианты только из `options` и только из своей руки, таймер по `expiresAt`

## Что не закрыто

- Живой прогон **в браузере** с двумя зрителями окна `await_choice` не делался: проверен
  socket-уровень (что именно долетает до клиента) и рендер через страж-скрипты. Ручной
  прогон в браузере — за Тестировщиком, когда освободится мост.
- Хвост из прошлой сессии: открытый handle `setTimeout` в `schedulePendingResolution`
  (jest пишет «did not exit one second after the test run»). Не дефект игры, но шум в логе.
