# D-2b: тип SocketErrorCode vs реальные коды сервера — RED

Дата: 11.11.2026. Автор: Тестировщик. Статус: RED сдан, ждёт GREEN от Бэкенда.

## Корень дефекта

- `server/src/socket/handlers.ts` L114–128, `ackFromOutcome`:
  `const code = (outcome.body && (outcome.body.code as SocketErrorCode)) || 'BAD_REQUEST';`
  приведение `as SocketErrorCode` без проверки — тип лжёт.
- Продюсер кода: `server/src/gameService.ts` L2252 (`resolvePendingNow`) отдаёт
  `{ message: 'Nothing pending', code: 'nothing_pending' }` мимо `fail()`.
- Union `SocketErrorCode` (handlers.ts L32–39) содержит 7 uppercase-кодов;
  `'nothing_pending'` в нём отсутствует.
- `ServiceErrorCode` (gameService.ts L559–566) — тот же набор из 7 uppercase-кодов,
  `'nothing_pending'` тоже нет. Ветка L2252 не типизирована этим типом.

## RED-механизм

`ts-jest` 29.4.1 диагностирует типы (проверено пробником `test/_te_tc_probe.test.ts`
с намеренной ошибкой: TS2322 уронил сьют, exit 1; пробник удалён).
`tsc --noEmit` тесты не собирает (`tsconfig.json` include: `src/**`, `../shared/src/**`),
поэтому единственный честный RED-механизм для тестов — диагностика ts-jest.

## Тест

`server/test/socketErrorCode.test.ts` (2536 б):

- `const produced: SocketErrorCode = 'nothing_pending';` — компиляционная проверка (RED).
- `kept: SocketErrorCode[]` из 7 uppercase-кодов — контроль, что расширение ничего не сломало.
- runtime-контроль продюсера: `POST /api/game/test/create` → `POST /api/game/:id/resolvePending`
  без окна → 400 и `body.code === 'nothing_pending'`.

## Доказательства

### RED (чистый код)

```
test/socketErrorCode.test.ts:27:7 - error TS2322: Type '"nothing_pending"' is not assignable to type 'SocketErrorCode'.
Test Suites: 1 failed, 1 total
Tests:       0 total
JEST_EXIT=1
```

### GREEN-проверка (мутация M-D2b: в union добавлен `'nothing_pending'`)

```
PASS test/socketErrorCode.test.ts
  √ тип принимает nothing_pending и сохраняет uppercase-коды
  √ контроль продюсера: resolvePending без окна отдаёт code nothing_pending
Tests: 2 passed, 2 total
JEST_EXIT=0
```

### Невакуумность runtime-части (мутация M-D2b-2: из продюсера убран `code`)

```
Tests: 1 failed, 1 passed, 2 total
Expected: "nothing_pending"  Received: undefined
test/socketErrorCode.test.ts:57
```
Краснеет ровно один тест, ровно на проверяемом правиле.

### Откаты

- `src/socket/handlers.ts`: BEFORE_SHA `e9a587be3fb1ab82bef232dcc28458a4dffe93957f6a442aefe3cbaa27b4ae36`,
  AFTER_SHA идентичен, размер 14663 б — BYTE_IDENTICAL.
- `src/gameService.ts`: AFTER_SHA `9201445330f8acd708659a850f9ed6e31198233af3cbccf5a43157636fd975fb`
  (совпадает с откатом D-2).

### Полный гейт

```
jestExit=1  tscExit=0
suites=59  tests=535  passed=531  failed=0  skipped=4
failing=["socketErrorCode.test.ts"]   (падает на компиляции — ожидаемый RED)
srcHash 8466cafe4fede4ca до и после — IDENTICAL
```

Baseline был 58 сьютов / 535 / 531 passed / 0 failed / 4 skipped.
Новый сьют добавился (+1 сьют), ни один прежний тест не покраснел. Регрессий нет.

## Что требуется от Бэкенда

1. Расширить `SocketErrorCode` (handlers.ts L32–39) значением `'nothing_pending'`.
   Код `'nothing_pending'` в продюсере (gameService.ts L2252) **не менять** —
   его фиксирует R07 в `test/restErrorCode.test.ts` и S19 в `test/socket.test.ts`.
2. Приёмка: `test/socketErrorCode.test.ts` 2/2 зелёные без правки теста,
   полный гейт 59 сьютов без новых красных, `tsc --noEmit` exit 0.
3. Отдельно к решению Аналитика: нужен ли единый тип для REST (`ServiceErrorCode`
   + lowercase-коды) или два раздельных типа с явным маппингом.

## Не покрыто

- Остальные lowercase-коды REST (`not_your_turn`, `card_not_in_hand`, `wrong_phase`,
  `game_not_found`, `bad_request`, `pending_action`) в union не проверяются:
  они попадают в socket-ack только через тот же `ackFromOutcome`, но живого
  socket-пути для них в этом тесте нет.
- `resolvePendingNow`-ветки L2262/L2267/L2274 отдают тела без `code` вовсе —
  вопрос к решению Аналитика, отдельная задача.

## Временные файлы (нужно разрешение Аналитика на удаление)

`server/_te_d2b_mut.js`, `server/_te_d2b_mut2.js`, `server/_te_d2b_gate.js`,
`server/_te_d2b_gate.json`, `server/_te_d2b_gate.out.json`.
