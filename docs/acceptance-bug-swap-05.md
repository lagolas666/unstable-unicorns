# BUG-SWAP-05 — терминальный 409 при нуле кандидатов на swap

Дата: 07.11.2026. Автор: Единорог Бэкенд.

## Дефект
При swap с `destination_player: 'chosen'` и нулём кандидатов (у всех соперников зона обмена пуста)
ответ 409 отдавал `needTargets: true`, `kind: 'players'` и `options.players` со списком **всех**
соперников — включая тех, у кого нет карт. Фронтенд открывал окно выбора, повторный `/play`
с таким `targetPlayerId` падал в 400. Выбор был невыполним.

## Правка
Обе точки публикации отказа приведены к терминальной форме: `409 { message: 'No opponent can swap cards', noSwapCandidates: true }`
— без `needTargets` и без `options.players`. Ветка «кандидатов > 1 без выбора» не тронута (окно выбора остаётся),
ветка «ровно один кандидат» по-прежнему автоподбирает.

| файл | что | чейндж |
|---|---|---|
| `server/src/gameService.ts` | `swapChoiceRequirement()` — терминальный отказ | +6/−1, sha 689fec2260283e8f, 143359 б |
| `server/src/routes/game.ts` | дубль-guard в `playWithTargets` | +2/−1, sha 266a6b9774bcbc18, 63693 б |

`executor.ts` не тронут (69237d238c87d4b3). Бэкапы: `*.prev_swap5` рядом с файлами.

## Доказательства
Пробник `server/_be_swap5_probe.js` (15 проверок): **pass=15 fail=0, exit=0**
- C1 (у p2 и p3 пусто): 409 без `needTargets`/`options.players`, флаг `noSwapCandidates`, карта в руке, AP 1→1, сброс пуст.
- C2 (карты у p2 и p3): прежнее окно — `needTargets: true`, `kind: 'players'`, `options.players = ['p2','p3']`.
- C3 (карты только у p2): окна нет, обмен состоялся.

Мутация `_be_swap5_mut.js`: возврат старой формы 409 → пробник `exit=1`, **fail=3** (C1 needTargets / options.players / noSwapCandidates), откат `RESTORED MATCH=true`.

Гейт `_be_swap5_gate.js`: **TSC_EXIT=0, JEST_EXIT=0, 53 сьюта, 493 теста, 489 passed, 4 skipped, FAIL_SUITES=0, 35.8 с**.
Гигиена: gameService crlf=2383 loneLF=0 FFFD=0; routes crlf=1161 loneLF=0 FFFD=0.

## Дыра покрытия (Тестировщику)
`server/test/swapTransport.test.ts` мутацию **не ловит**: при старой форме 409 сьют остаётся зелёным (5 passed).
Кейс C1 (ноль кандидатов → терминальный отказ без окна) нужно перенести в `server/test/**`;
пробники вне `server/test/` доказательством покрытия не считаются.

## Осторожно
Откат в мутационном раннере восстанавливает файл из `.prev_swap5` — снимка **до** патча.
После мутационного прогона правку нужно накатывать заново (`_be_swap5_patch.js`) и сверять sha.
