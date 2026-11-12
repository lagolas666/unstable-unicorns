# Приёмка: BUG-SWAP-05 follow-up (`swapCandidatesFor`)

Аналитик, 07.11.2026. Проверка правки Бэкенда в `server/src/gameService.ts` и `server/src/engine/executor.ts`.

## Что проверялось

Расхождение в отчёте Бэкенда: заявлено «gameService.ts не трогал», фактически файл изменён.

Дифф `gameService.ts` (L44-78): `swapChoiceRequirement` перестал считать кандидатов своим «зона не пуста»
и вызывает `swapCandidatesFor(state, player.id, chosenSwap)` из executor.ts.
Импорт на L20: `triggerEnterEffectsFor, swapCandidatesFor`.

sha до и после моих прогонов: `gameService.ts` = 8dbeea639be2, `executor.ts` = 76a5baa4bdb5, оба восстановлены побайтово
(`BYTE_IDENTICAL=true`).

## Свой гейт (не принимал на слово)

| Проверка | Результат |
|---|---|
| jest, полный, из `server/` | EXIT=0, 53 сьюта, 495 тестов: 491 passed / 4 skipped, FAIL_SUITES=0 (100 c) |
| tsc `--noEmit` | EXIT=0 |
| SRC_HASH | 4c434e7be16fd718 (отличается от baseline 386540f3993083d0 — файлы правились, ожидаемо) |

Baseline по количеству сьютов и тестов совпадает: 53/495/491/4.

## Правка работает (пробник)

`_an_swapsync_probe.js`, легаси-диалект swap с фильтром стороны B:

- K1 без флагов → `['p2','p3']` PASS
- K2 у p2 `cannot_be_targeted` → `['p3']` PASS
- K3 оба защищены → `[]` PASS

## НО: правка не покрыта ни одним тестом

1. `server/test/**`: 0 упоминаний `swapCandidatesFor`, `swapEligibleOwners`, `swapChoiceRequirement`,
   `cannot_be_targeted`.
2. Мои мутации на полном гейте (каждая hits=1, откат побайтовый):

| Мутант | Что делает | Полный гейт | Вердикт |
|---|---|---|---|
| M-A | `gameService.ts`: вернуть старое «зона не пуста» вместо `swapCandidatesFor` | EXIT=0, 491 passed, FAIL_SUITES=0 | **SURVIVED** |
| M-B | `executor.ts` L669-аналог: `swapEligibleOwners(ctx, owners, selector)` без `actorId` в `swapCandidatesFor` | EXIT=0, 491 passed, FAIL_SUITES=0 | **SURVIVED** |

Оба мутанта откатывают ровно то поведение, ради которого сделана правка, и гейт молчит.

3. Мой пробник под мутантом M-B: `FAIL K2 got=["p2","p3"] want=["p3"]`, `FAIL K3 got=["p2","p3"] want=[]`.
   То есть проверка ловит регрессию, а гейт — нет.

## Остаточная несогласованность (в коде)

`executor.ts` L669 (`swapOpponentCandidates` → автоподбор при исполнении):
`swapEligibleOwners(ctx, owners, selector)` — **без** `actorId`.
`executor.ts` L726 (`swapCandidatesFor` → транспорт):
`swapEligibleOwners(ctx, owners, selector, playerId)` — **с** `actorId`.

L709-712: при отсутствии `actorId` проверка `isTargetableFor` вообще не выполняется. Транспорт и исполнитель
снова отвечают по-разному — тот же класс дефекта, который правкой закрывался, только сдвинут на шаг:
соперник с одними `cannot_be_targeted` даёт лишнего кандидата в окне выбора, исполнитель исполняет через
вышестоящую проверку. На данных v2 ненаблюдаемо (см. ниже), на легаси-диалекте достижимо.

## Данные v2

- `cannot_be_targeted` в `catalog.v2.json`: **0 вхождений**; `cannotBeTargeted`: 0; `immune`: 1.
- `unicorns.json`: 0 вхождений.
- карт-масок (`blocks_unicorn_effects` / `is_mask` / subtype mask): 0.

Вывод: на каталоге v2 добавленное условие `isTargetableFor` в обмене **не наблюдаемо** — оно защищает легаси-диалект
и будущие данные. Ценность правки реальная, но проверить её на v2 нельзя, поэтому тест обязан быть на синтетической
фикстуре с явным флагом.

## Сводка по #39 (зоны cannot_be_targeted)

Ранее две мутации по `cannot_be_targeted` выжили. Причина та же: в данных v2 таких карт нет, покрывать нечего.
Зона объявлена, данных нет — это не дефект кода, а отсутствие фикстуры.

## Вердикт

- Каркас BUG-SWAP-05 (терминальный 409 без окна выбора, T6/T7) — **принят**.
- Follow-up `swapCandidatesFor` — **НЕ принят**. Правка верна по смыслу (K2/K3 доказывают), но:
  1) гейт её не охраняет (2/2 мутанта выжили);
  2) осталась асимметрия L669/L726.
- Задача возвращается Бэкенду на L669 и Тестировщику на `server/test/swapCandidates.test.ts`.

## Условия повторной приёмки

1. Бэкенд: `swapOpponentCandidates` L669 передаёт `actorId` в `swapEligibleOwners`; после правки полный гейт
   обязан быть зелёным (53/495/491/4, tsc 0).
2. Тестировщик: `server/test/swapCandidates.test.ts`, минимум 5 кейсов — контроль без флагов, один защищён,
   оба защищены, `>>` одного кандидата (окно не требуется), отказ при нуле кандидатов и `required` в
   `swapChoiceRequirement` согласован с `swapCandidatesFor`.
3. Красный на мутантах: M-A и M-B обязаны валить сьют с текстом упавшего ассерта, hits=1, откат побайтовый.

## Файлы проверки (корень workspace)

`_an_swapsync_ctx.js|txt`, `_an_swapsync_verify.js`, `_an_swapsync_gate.js` + `_an_swapsync_gate_jest.log`,
`_an_swapsync_gate_tsc.log`, `_an_swapsync_gate_summary.txt`, `_an_swapsync_testgrep.js`,
`_an_swapsync_mut.js` + `_an_swapsync_mA.log`, `_an_swapsync_mA_full.log`, `_an_swapsync_mB.log`,
`_an_swapsync_mut_summary.txt`, `_an_swapsync_zones.js`, `_an_swapsync_mask.js`,
`_an_swapsync_probe.js`, `_an_swapsync_probe_mut.js`, `_an_swapsync_calls.js`,
`_an_swapsync_gameservice.diff.txt`.

## Пересмотр 07.11.2026: ПРИНЯТО

Задача: передать актора в автоподбор соперника для swap (L669 держал `swapEligibleOwners` без `actorId`,
из-за чего `isTargetableFor` не проверялся в предпроверке и в ветви исполнения исполнителя).

### Что реально изменено

Файл один: `server/src/engine/executor.ts`, 5 точек (сверено с `.prev_swapsync2`, построчный дифф):

| Строка (cur) | Было | Стало |
|---|---|---|
| 477 | `swapOpponentCandidates(ctx, ownersB, selSwap.b)` | `…, player.id)` — предпроверка `isActionPossible` |
| 659–661 | без параметра | `actorId?: string` в сигнатуре + комментарий |
| 672 | `swapEligibleOwners(ctx, owners, selector)` | `…, actorId)` |
| 706 | «Актора передаёт только сервисный путь» | «передают оба пути» |
| 1376 | `swapOpponentCandidates(ctx, bOwnersRaw, bSel)` | `…, player.id)` — ветвь `executeAction` |

Дифф: 7 вставок / 4 удаления. `gameService.ts` не тронут (sha `8dbeea639be2`,
mtime 19:12 против 20:10 у executor.ts). Прочие файлы `server/src` не менялись — сверено по mtime всех 38 файлов.

### Гигиена файла

`size=116706`, sha256 `5cb7068a46d1ea1b`, `FFFD=0`, `MOJIBAKE=0`, `CTRL(U+0402–U+040F)=0`,
`LONE_LF=0`, CRLF=2047. Бэкап `executor.ts.prev_swapsync2` (116390 б, sha `76a5baa4bdb505ee`) на месте.

### Гейт (мой прогон, из `server/`)

```
JEST EXIT=0, 53 suites passed / 53
Tests: 4 skipped, 491 passed, 495 total
TSC EXIT=0, TS_ERRORS=0
SRC_FILES=38 SRC_HASH=e000eec21f93f9b8
```
Совпадает с baseline #29 (53/495/491/4, tsc 0). SRC_HASH изменился относительно 386540f3993083d0 — ожидаемо: в него входит executor.ts.

### Доказательство эффекта (главное, чего не было в DONE Бэкенда)

Заявление Бэкенда «на v2 правка ненаблюдаема» верно: в `catalog.v2.json` 0 карт с `cannot_be_targeted`,
масок 0. Поэтому эффект доказан на синтетике, а не на данных.

Пробник `server/_an_swapsync2_exec_probe.js`: 3 игрока, у p2 карта с `cannot_be_targeted: true`,
действие в форме каталога v2 (`.target` + `.destination` + `.destination_player: 'chosen'`),
вызов через `resolveActions` (реальный путь исполнения, а не только `swapCandidatesFor`).

```
BEFORE  E1=true  E2=false  E3=false     p1.hand=["c1"] p3.hand=["a1"]
MUTANT  E1=false E2=false  E3=false     (мутация: снять ", player.id" с обоих вызовов)
AFTER   E1=true  E2=false  E3=false
MUTATION_CAUGHT=true
```
- E1 — p2 защищён, p3 свободен: до правки `withCards=2` → `undefined` → отказ, после правки защищённый отсекается изнутри → ровно один кандидат → обмен состоялся (`ok=true`, руки реально поменялись).
- E2 — оба защищены: отказано и до, и после (мутационно неизменно, ожидаемо).
- E3 — никто не защищён: отказано и до, и после — автоподбор неоднозначен, это BUG-SWAP-03, работает как задумано.

Мутация: `TOTAL_HITS=2`, каждый анкер `hits=1`, `MUTANT_SHA=2761c0c7d0877aa5`,
откат побайтовый `RESTORED_SHA=5cb7068a46d1ea1b BYTE_IDENTICAL=true`. Сборка не ломается — поведенческая мутация.

Отдельный пробник `server/_an_swapcand_probe.js` (`swapCandidatesFor`, 5 кейсов K1–K5):
K1 защищённый исключён → `["p3"]`; K2 оба защищены → `[]`; K3 без флагов → `["p2","p3"]`;
K4 пустая рука исключена; K5 актор не кандидат. `PROBE_FAILS=0`. Замечание: K1–K5 зелёные и на коде
до правки — `swapCandidatesFor` и раньше передавал `playerId`, поэтому доказательством эффекта
правки они не являются. Доказательство — только E1 выше.

### Остаточная асимметрия (новая, в объём задачи не входила)

`swapOpponentCandidates` L664: `if (owners.length <= 1) return owners;` — выходит ДО фильтра,
и `actorId` там не применяется. На 2 игроках единственный соперник с `cannot_be_targeted` проходит:

```
R1 (2 игрока, единственная карта соперника защищена)
   swapCandidatesFor=[]                       <- транспорт окно не откроет, это верно
   resolveActions ok=false                    <- эффекта нет, мутаций нет, это тоже верно
R2 (тот же случай без флага) resolveActions ok=true  p1.hand=["b1"]  <- контроль, обмен работает
```
Наблюдаемый вред: `isActionPossible` для 2 игроков отвечает «можно» (возвращает `true`, т.к. отказ
приходит позже, из `collectSide`), значит UI покажет карту играбельной, а исполнение вернёт `false` —
тот же класс расхождения «UI считает играбельной / исполнение отказывает», который правка убирала для 3+.
Мутаций состояния нет, поэтому это дефект отображения, не порчи состояния. Заводится отдельной задачей.

### Вердикт: ПРИНЯТО

Правка минимальна (одна точка входа актора, без нового поля в `ResolveContext`), поведение на v2
не меняется, гейт в baseline, эффект доказан обратной мутацией с побайтовым откатом.
Открыто (не блокирует приёмку): (1) ветка `owners.length <= 1` без фильтра; (2) тест
`server/test/swapCandidates.test.ts` — зона Тестировщика.
