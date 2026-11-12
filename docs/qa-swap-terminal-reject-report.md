# Приёмка BUG-SWAP-05: терминальный 409 при нуле кандидатов на swap

**Дата:** 07.11.2026
**Автор:** Единорог Тестировщик
**Статус:** принято, кейс закреплён в гейте

## Что было сломано

Swap с `destination_player:'chosen'` при пустой зоне обмена у всех соперников отвечал
`409 { needTargets: true, kind: 'players', options: { players: [все соперники] } }`.
Клиент открывал окно выбора соперника, а повторный `/play` с таким `targetPlayerId`
падал в 400 `Invalid target player` — выбор был невыполним по построению.

Причина: список кандидатов строился из всех соперников, а не из тех, у кого в зоне
обмена есть карты. Ветка «кандидатов 0» не отличалась от ветки «кандидатов > 1 без выбора».

## Правка Бэкенда (принята)

| Файл | Что | sha256 (12) | Размер |
|---|---|---|---|
| `server/src/gameService.ts` | `swapChoiceRequirement()` → терминальный отказ `noSwapCandidates: true` | `689fec226028` | 143359 б |
| `server/src/routes/game.ts` | дубль-guard в `playWithTargets` (L767-770) | `266a6b9774bc` | 63693 б |

Терминальная форма: `409 { message: 'No opponent can swap cards', noSwapCandidates: true }` —
без `needTargets`, без `options.players`, текст не содержит `/target player/i`.
Ветки «кандидатов > 1 без выбора» (окно) и «ровно один» (автоподбор) не тронуты.
`executor.ts` не затронут.

## Что добавлено в тест-гейт

`server/test/swapTransport.test.ts` — два новых кейса (было 5 `it`, стало 7):

- **T6** (`/play`, сервисная точка `gameService.ts` L726-731): 409, `noSwapCandidates: true`,
  `needTargets` отсутствует, `options` отсутствует целиком, текст не про target player,
  карта осталась в руке, сброс пуст, AP `1`, руки соперников пусты. Плюс проверка тупика:
  повторный `/play` с `targetPlayerId:'p2'` не даёт 200 и не мутирует состояние.
- **T7** (`/playWithTargets`, дубль-guard `routes/game.ts` L767-770): та же терминальная форма,
  зоны и AP не тронуты.

Существующие T1–T5 не изменялись.

Файл: 11209 б, CRLF 236, loneLF=0, U+FFFD=0, mojibake=0,
sha256 `4f9746c13dadb62898c4fac30ef3e1c8514a11cda8b12a447fdf00db5977317d`.
Бэкап до патча: `server/test/swapTransport.test.ts.prev_swap5_qa`.

## Доказательства

```
node _te_run_one.js test/swapTransport.test.ts
  EXIT=0  suites=1 tests=7 passed=7 failed=0
  PASS T1..T7
```

Мутации (файлы `src/**` восстанавливались из снимка в памяти, не из `.prev_*`):

```
node _te_mut_swap5.js          (обе точки сразу)
  BEFORE svc=689fec226028 routes=266a6b9774bc
  JEST_EXIT=1  tests=7 passed=5 failed=2
  RED=T6,T7  GREEN=T1,T2,T3,T4,T5  MUTATION_CAUGHT=true
  RESTORED svc=689fec226028 routes=266a6b9774bc  BYTE_IDENTICAL=true

node _te_mut_swap5_split.js    (расщепление)
  M-6a svc-only   failed=1 RED=[T6] CAUGHT=true BYTE_IDENTICAL=true
  M-6b route-only failed=1 RED=[T7] CAUGHT=true BYTE_IDENTICAL=true
```

Полный гейт:

```
node _te_gate_swap5.js
  TSC_EXIT=0  TSC_LINES=0
  JEST_EXIT=0  time=100.1s
  suites=53 tests=495 passed=491 failed=0 skipped=4
  FAIL_SUITES=0
  SRC_HASH=386540f3993083d0  SRC_UNCHANGED=true
```

Baseline до приёмки был 53 сьюта / 493 теста / 489 passed / 4 skipped —
новый baseline 53 / 495 / 491 / 4 (+2 теста, ни один прежний не покраснел).

## Вывод

Дефект BUG-SWAP-05 закрыт и закреплён: регрессия незаметной не вернётся.
Раньше эту дыру штатный сьют не ловил (при старой форме 409 все 5 кейсов были зелёными) —
теперь каждая из двух точек публикации отказа держит свой кейс отдельно.

## Временные скрипты (не в гейте, удаление — по решению Аналитика)

`server/_te_patch_swap5.js`, `_te_run_one.js`, `_te_hyg_swap5.js`, `_te_dump_swap5.js`,
`_te_dump_swap5b.js`, `_te_mut_swap5.js`, `_te_mut_swap5_split.js`, `_te_gate_swap5.js`.
