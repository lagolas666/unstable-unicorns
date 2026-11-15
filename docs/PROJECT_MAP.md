# PROJECT_MAP — Карта задач «Неудержимые единороги»

> Последнее обновление: 16.11.2026 — V7-4: этапы 1–4 инфраструктуры приняты (schema/frame/pump/DrawFrame lifecycle); runtime draw-trigger continuation отложена по решению Даниила (вариант B). Два integration RED `v74ExecutorDrawTrigger.test.ts` остаются вне текущего scope. См. `docs/HANDOFF_2026-11-16.md`.
- **V7-3 ПРИНЯТ: prevent/destroy, prevent/on_enter_stable, reactive_trigger, modify_action. Все 5 RED-тестов зелёные. Регрессия 63/63 suites, 541 passed, 4 skipped.**
- **Решение Даниила (14.11.2026): сложную механику отмены жертвы для «Вмешательства» пока не реализовывать; карту временно не включать в колоду. В JSON-каталогах она помечается `active:false`, `deck_count:0`. Это откладывает только данную ветку V7-4, не всю V7-4.**
> Правило: агент начинает работу → переводит задачу в **В работе**; завершает → в **На проверке**; Аналитик/Тестировщик → в **Готово**.

---

## 🟢 Готово (Done)

| Задача | Принято | Кем |
|--------|---------|-----|
| V7-4 этап 1 — schema-only `ContinuationEnvelope` (`JsonValue`, `version: 1`, optional `GameEntry.continuation`); принято только как контракт хранения, не как runtime continuation | 15.11.2026 | Аналитик — независимая проверка: `cd server; npx tsc --noEmit` exit 0; `git diff --check -- server/src/gameStore.ts` exit 0. Полный Jest остаётся красным: 66 suites passed / 1 failed; 575 passed / 2 failed / 4 skipped. Оба RED — `v74ExecutorDrawTrigger.test.ts` (строки 57, 138), вне schema-only scope; V7-4 целиком НЕ принята. В diff также присутствуют `pendingQueue`/`QueuedReaction`; авторство не установлено и им не атрибутируется этот этап. |
| V7-4 этап 2 — `continuation.ts`: typed plain-data Play/Effect/Action/Trigger/Draw frames, pure stack/cursor helpers и envelope JSON validation/round-trip; runtime не подключён | 15.11.2026 | Аналитик — тест `continuation.test.ts` 11/11, `npx tsc --noEmit` exit 0; полный Jest 67/68 suites, 586 passed / 2 failed / 4 skipped. Оба RED — ожидаемые `v74ExecutorDrawTrigger.test.ts` (строки 57, 138), вне scope этапа 2. |
| V7-4 этап 3 — чистый `pumpStep` guard в `continuation.ts`: блокирует при active/queued pending, иначе сообщает верхний кадр или complete; без runtime-вызовов и мутации continuation | 15.11.2026 | Аналитик — независимый целевой Jest `continuation.test.ts` + `continuationPump.test.ts`: 2 suites / 16 tests PASS; `npx tsc --noEmit` exit 0; scoped `git diff --check` exit 0. Полный Jest: 68/69 suites, 591 passed / 2 failed / 4 skipped; оба известных RED `v74ExecutorDrawTrigger.test.ts:57,138`; предупреждение об async operations. Чужой `docs/MONETIZATION_AND_AVATARS.md` whitespace вне scope. Принят только pump infrastructure, не gameplay continuation/V7-4. |
| V7-4 этап 4 — чистые DrawFrame lifecycle helpers (`nextDrawAttempt`, `resolveDrawAttempt`): следующая попытка/завершение, один результат на один добор, отмена расходует только текущую попытку; runtime/service не подключены | 15.11.2026 | Аналитик — независимо проверено: целевые Jest 3 suites / 27 tests PASS; `npx tsc --noEmit` exit 0. Полный Jest 69/70 suites, 602 passed / 2 failed / 4 skipped; оба известных RED `v74ExecutorDrawTrigger.test.ts:57,138`; предупреждение о незавершённых async operations. Изменения в новых untracked файлах проверены чтением; `git diff --check` к ним не применим. Принимается только lifecycle helpers, не runtime draw continuation/V7-4 целиком. |
| База данных: 329 карт в v2, Mongoose схема Card.ts | 07.11.2026 | Аналитик |
| Словарь эффектов docs/effect-vocabulary.md (43 kind, 19 trigger) | 07.11.2026 | Аналитик |
| exclude_self — фильтр matchesFilter (E1–E4 зелёные) | 06.11.2026 | Аналитик |
| BUG-SWAP-05 — терминальный 409 при невозможном обмене | 07.11.2026 | Аналитик |
| BUG-SWAP-05 follow-up — swapChoiceRequirement, swapCandidatesFor | 07.11.2026 | Бэкенд |
| Загрузка изображений карт (POST /api/upload, PUT /api/cards/:id) | 05.11.2026 | Аналитик |
| enter-эффекты из данных (вариант 1, on_enter_stable из v2) | 05.11.2026 | Бэкенд |
| Малыш — isNurseryOnly, source_zone, routes/game.ts | 05.11.2026 | Аналитик |
| BUG-01 (hand_limit таймер, автосброс запрещён) | — | Бэкенд |
| BUG-02 (отменённая Neigh уходит в сброс) | — | Бэкенд |
| Гипнорог (H1–H4 зелёные) | — | Бэкенд |
| Движок gameInstance.ts — 14 зелёных сьютов | — | Бэкенд |
| scope — приёмка закрыта, мутация self→[] не просится | 04.11.2026 | Аналитик |
| Опциональные эффекты — affordancesFor, optionalSkipped | 02.11.2026 | Аналитик |
| Тесты API-контракта (apiContract.test.ts, 17 it) | 11.11.2026 | Тестировщик |
| Документ API_CONTRACT.md переписан под реальный код (D-1,D-3,D-5,D-6,D-7) | 11.11.2026 | Аналитик |
| D1b-2: решафл сброса в колоду при доборе (reshuffleDiscardIntoDeck в executor.ts) | 11.11.2026 | Аналитик |
| D-2: поле `code` в REST-ошибках — гейт 535/531/0/4, мутация штатная | 11.11.2026 | Тестировщик |
| V7-1-2: while_in_stable диспетчер — executor.ts L236-266, 24 карты, 8 тестов зелёные | 12.11.2026 | Аналитик |
| D-2b/c/d: SocketErrorCode расширение кодами nothing_pending и импорт ServiceErrorCode | 11.11.2026 | Бэкенд |
| V7-3: заглушки while_in_stable kind (prevent/destroy, prevent/on_enter, reactive_trigger, modify_action) | 12.11.2026 | Бэкенд |
| Oceloticorn Neigh flags: data-driven regression tests and fallback removal accepted; 6/6 targeted, full Jest 66 suites / 572 passed / 4 skipped, TSC 0 | 13.11.2026 | Аналитик |
| V7-4 остаточный REST API contract: §1.5 `resolvePending` (`confirm`, optional decline/skip, владелец окна, отмена, HTTP outcomes) сверён с `resolvePendingNow` | 13.11.2026 | Аналитик |

---

## 🔵 На проверке (QA)

| Задача | Передано | Проверяет |
|--------|----------|-----------|
| Удалить только невалидный post-success direct `cancel` RED; целевые/полные гейты сверены | 14.11.2026 | Аналитик — ПРИНЯТО: целевой 11/11; Jest 66 suites / 572 passed / 4 skipped, TSC exit 0; предупреждение async operations оставлено отдельным follow-up. |


---

## 🟡 В работе (In Progress)

> Актуально на 16.11.2026: активной runtime-задачи V7-4 draw continuation сейчас нет. Запись о ранее планировавшемся draw pre-trigger/PlayFrame ниже историческая и superseded решением Даниила (вариант B); runtime-интеграция отложена. Текущая сводка и проверенный Git-блокер: `docs/HANDOFF_2026-11-16.md`.


| Задача | Исполнитель | Старт |
| V7-4 draw continuation runtime - DEFERRED 2026-11-16 (Daniil, option B). Infrastructure stages 1-4 only; no gameplay runtime. Two integration RED cases in `v74ExecutorDrawTrigger.test.ts` remain outside current scope (last targeted Jest: 2 failed, exit 1). Resume only after separate scope approval. Details: `docs/HANDOFF_2026-11-16.md`. | Deferred | 2026-11-16 |

## 🔴 Бэклог (Backlog)

### Приоритет 2 — V7-3: оставшиеся while_in_stable kind
- [x] RED-тесты (Тестировщик) — готовы, v7RedMissingKinds.test.ts
- [x] Архитектура реакций (reactive_trigger, modify_action, prevent/destroy, prevent/on_enter) — заглушки

### Приоритет 3 — Декомпозиция game.ts (1088 строк)
- [ ] Вынести gameStore.ts (сделано, Map games)
- [ ] Перевести socket + /lobby + /room на gameStore
- [ ] /playtest оставить отладочной панелью

### Приоритет 5 — Админка карт
- [ ] Расширение схемы Mongoose (TRIGGERS: 13→19 значений)
- [ ] Динамический словарь эффектов из catalog.v2.json
- [ ] EffectChip с иконкой (Fig-стиль)
- [ ] UI редактирования эффектов карты

### Follow-up отдельно от V7-4
- [ ] Локализовать и устранить/корректно очистить hand-limit `Timeout` в `schedulePendingResolution` (`endTurn` → `openHandLimitWindow`); это отдельная задача и не входит в текущий V7-4 follow-up.

- [ ] V7-4 follow-up draw-trigger — **ОТЛОЖЕНО 16.11.2026 по выбору Даниила (вариант B):** текущая реализация ограничена уже принятыми чистыми DrawFrame lifecycle/helpers; runtime-интеграция не выполняется, отдельный helper этап не передаётся, поскольку чистые helpers уже приняты (V7-4 этап 4). Интеграционные RED `v74ExecutorDrawTrigger.test.ts` остаются известными и не принимаются как критерий helper-only scope: JSON restore двух draw и nested `on_opponent_sacrifices`/outer-effect ordering требуют сериализуемого effect cursor и подключения обоих `trigger_effect` service pending paths. Последняя targeted проверка Бэкенда: 2 failed, exit 1; код не менял; полный Jest/tsc не запускал. Возобновлять только по отдельному решению о runtime continuation scope. Не менять официальный `/draw`/`deferredDraw`, arbitrary deferred effects, пред-sacrifice/general cancel. Существующие shared diffs не атрибутировать; никаких сравнений по имени карты.
- [ ] Direct `cancel` в executor — ОТЛОЖЕНО 14.11.2026 по решению Даниила: текущий тест `direct cancel action in a non-draw trigger...` в `server/test/v74FollowupTriggers.test.ts` признан невалидным критерием, поскольку `on_opponent_sacrifices` — post-success событие и активной цели `stack` уже нет. Не реализовывать фиктивный no-op и не отменять/откатывать жертву задним числом. Возобновлять только с отдельным тестом, где `cancel` получает реально активную цель.
- [x] Каталог-инварианты Nursery актуализированы Тестировщиком (14.11): только `server/test/nurseryDeal.test.ts`; расчёт включённых копий использует `active` и `deck_count`; целевые Nursery 10/10 и Neigh/F9 6/6 зелёные.
- [ ] V7-4: `on_opponent_would_sacrifice` и механика «Вмешательства» — ОТЛОЖЕНО 14.11.2026 по решению Даниила. Не реализовывать и не включать карту в игру до отдельного возобновления. Контракт на будущее: отмена до перемещения/триггеров; отменённая стоимость входа отправляет единорога в сброс; отмена первой жертвы прекращает эффект. Старый post-success RED невалиден для этого поведения. В JSON-каталогах карта отключается `active:false`, `deck_count:0`; состояние Mongo отдельно проверить при возобновлении, без изменений БД без отдельного разрешения.
- [x] Удалить name-based fallback Oceloticorn из `server/src/routes/game.ts`; поведение data-driven через flags. Regression: `ocelotcornNeighFlags.test.ts` 6/6; полный гейт 66 suites / 572 passed / 4 skipped; TSC 0 (13.11.2026).
- [x] Актуализировать §1.5 `docs/API_CONTRACT.md`: `confirm`, optional `trigger_effect`, владелец окна, отказ без подтверждения, `skip`, ветки отмены и HTTP outcomes; сверено с REST-реализацией.

### Приоритет 6 — Перенос макетов из Figma
- [ ] Ассеты 1:1
- [ ] UI компоненты

---

## 📋 Архив закрытых задач

| Задача | Дата |
|--------|------|
| exclude_self — фильтр в executor.ts | 06.11.2026 |
| BUG-SWAP-05 (терминальный 409 при 0 кандидатах) | 07.11.2026 |
| Словарь эффектов docs/effect-vocabulary.md | 07.11.2026 |
| Тесты API-контракта (17 тестов, 4 мутации) | 11.11.2026 |
| API_CONTRACT.md переписан под реальный код | 11.11.2026 |
| V7-1-2: while_in_stable диспетчер (24 карты) | 12.11.2026 |
| D-2b/c/d: SocketErrorCode расширение | 11.11.2026 |
| Priority 4: снятие name-сравнений | 12.11.2026 |
| Анализ покрытия while_in_stable (effect-coverage.md) | 12.11.2026 |
| V7-4 follow-up draw-trigger ? DEFERRED 16.11.2026 by Daniil (option B). The pure DrawFrame helpers (stage 4) are accepted; no runtime pre-trigger, effect-cursor continuation, or service pending integration is in scope. Two integration RED tests remain unresolved/out of scope. Resume only after separate scope approval. | Deferred | 16.11.2026 |

- **Принято 14.11.2026:** Тестировщик удалил только тест `direct cancel action in a non-draw trigger is supported without executor fallback warning` из `server/test/v74FollowupTriggers.test.ts`; implementation/остальные тесты не заявлены изменёнными. Независимо: целевой набор 11/11 PASS; свежий `npm test -- --runInBand --silent` — 66/66 suites, 572 passed, 4 skipped, exit 0; `npx tsc --noEmit` — exit 0. Jest сообщил об оставшихся асинхронных операциях после прогона (отдельный hand-limit Timeout follow-up). Принято только снятие невалидного RED; Direct `cancel` отложен до контракта с реально активной stack-целью. V7-4 не принят.


> 15.11.2026 — `server/test/v74ExecutorDrawTrigger.test.ts` создан Тестировщиком и оставлен RED по двум согласованным контрактам: nested draw не должен расходовать deck до `on_opponent_would_draw` pending; при JSON restore ожидается сохранённый pending и возобновление всей `play` цепочки ровно один раз. BLOCKED от Тестировщика — обе несостыковки production continuation; он не менял исходники, probe удалён, полный baseline/TSC не запускались. Аналитик сверил с `docs/MEMORY.md` и утверждённым draw/play continuation scope в этой карте: тестовые ожидания не менять без нового решения; передать Бэкенду устранение root cause только в `server/src/**`, затем потребовать свежие целевой/полный Jest + `tsc --noEmit` и независимую приёмку. Пред-sacrifice остаётся отложен.


> 15.11.2026 — уточнение после read-only аудита Бэкенда: этап (1) frame union/storage НЕ передавать в реализацию до завершения полного инвентаря достижимых caller-циклов и их continuation-state. Найдены дополнительные вложенные продолжения через вход в стойло, уничтожение, поиск/перемещение и жертву; пять общих типов сами по себе не доказывают достаточность схемы. Следующий handoff — только read-only аудит с точками кода, стадиями/cursor/накопителями каждого достижимого caller и перечислением сериализуемого локального состояния. Изменение runtime и тестов не входит; scope `/draw`/`deferredDraw` остаётся исключённым. После аудита Аналитик фиксирует минимальный безопасный scope схемы.


> 15.11.2026 — уточнение BLOCKED после частичного аудита: backend подтвердил точку `POST /:id/playWithTargets` в `server/src/routes/game.ts` (801–918), отдельный play pipeline с `resolveActions`, циклом `resolveEffect`, enter-effects и `dispatchTrigger`; также не доказаны маршрутизация всех play roots до continuation и достижимость повторных `case 'sacrifice'`/`case 'destroy'`. Поэтому общий аудит остаётся открытым. Следующий запрос узко проверяет эти барьеры и трассирует, входит ли `playWithTargets` в согласованный play/draw scope (есть ли достижимый draw + pending continuation); не реализовывать схему и не менять тесты/код. Текущий backend report — частичный, полноту caller inventory не подтверждает.


> 15.11.2026 — закрыт узкий follow-up caller-аудита: `POST /api/game/:id/playWithTargets` подтверждён как достижимый будущий root для `kind: draw` из `on_play` через `resolveEffect → executeAction → executeDraw`; текущий `executeDraw` не создаёт `on_opponent_would_draw` pending (явный dispatch в `gameService.ts` относится к отдельному `/draw`/`deferredDraw`, исключённому из scope). Повторные `case 'sacrifice'`/`case 'destroy'` в исполняющем switch недостижимы: первые ветви завершаются `return`; одноимённые case в `isActionPossible` — отдельная feasibility-проверка. Это не закрывает полный caller inventory: `playWithTargets` после открытия будущего child-pending должен сохранять весь незавершённый play route/context, а оставшиеся достижимые caller/return циклы и локальные continuation-state не инвентаризированы. Schema/storage по-прежнему отложены; следующий шаг — read-only полный инвентарь согласованного play/draw scope с точками вызова/возврата, стадиями, cursor/accumulator и сериализуемым локальным состоянием; `/draw`/`deferredDraw`, пред-sacrifice/general cancel и arbitrary deferred effects исключены.


> 15.11.2026 — Результат расширенного read-only caller-аудита Бэкенда: описаны continuation-state для общих resolve loops, enter/destroy/pull/search/move/sacrifice и вложенных placement путей; отчёт прямо НЕ подтверждает полноту caller inventory/frame union. Схему/storage не реализовывать. Остаётся классифицировать достижимые roots и границы scope: `playWithTargets`, dispatcher/turn-start direct `resolveEffect`, реакционный `on_opponent_plays_neigh`, а также доказать, какие из них могут породить будущий draw pending и какие возвраты требуют сериализации. Следующий handoff — только read-only точечная трассировка этих roots до draw/return; никаких runtime/test изменений. После закрытия этих границ Аналитик уточняет минимальный безопасный scope и только затем отдельный handoff на schema.


> 15.11.2026 — Самостоятельная read-only проверка узких roots после BLOCKED от Бэкенда (`interrupted`): подтверждены три дополнительные точки, требующие классификации перед schema. `POST /:id/playWithTargets` (`routes/game.ts:671`, прямая ветка 801+) выполняет `resolveActions(costs)` и затем цикл `resolveEffect(on_play/immediate)`; после возврата ещё остаются placement/discard, post-play `dispatchTrigger`, списание AP и финализация ответа. `executeDraw` (`executor.ts:1340–1380`) сейчас немедленно меняет deck/hand и не открывает `on_opponent_would_draw`; ожидаемый pre-draw interception ещё не реализован, поэтому этот root включён в будущую область только при внедрении данного контракта.
>
> Turn-start direct roots: `POST /turnStart` вызывает `triggerTurnStartEffects` (`executor.ts:217+`), чей проход напрямую `await resolveEffect` для обязательных `on_turn_start` эффектов внутри вложенных zone/card/effect loops; также `/turnStart/activate` и `/turnStart/choose` напрямую зовут `resolveEffect`. Они могут содержать data-driven `kind: draw`, но сейчас `executeDraw` не открывает would-draw окно. Reaction roots: обычные play paths dispatch `on_opponent_plays_neigh`; `reactNeigh` после оплаты Neigh увеличивает `cancelLevel` и dispatch-ит тот же event (`gameService.ts:1743–1759`). Эффект такой реакции исполняется из `resolvePendingNow` (`gameService.ts:2403+`); его контекст создаётся напрямую без `ctxFor`/`requestReactionWindow`, поэтому будущий nested would-draw dispatch здесь потребует отдельно обеспечить callback и учесть внешний pending/queue.
>
> Граница аудита остаётся открытой: это классификация только названных roots, не полный inventory всех достижимых callers/cursors и не обоснование достаточности frame union. Schema/runtime/test не менялись; новые tool-driven тесты не запускались. До отдельного решения проверить полный caller graph, контекстную инъекцию для trigger-effect resume и минимальные serializable post-child данные. `/draw`/`deferredDraw`, arbitrary deferred events и пред-sacrifice/general cancel остаются вне scope.


> 15.11.2026 — Декомпозиция по запросу Даниила «не держать одну задачу днями»: вместо ещё одного общего аудита первый implementation handoff узкий и ограничен одним файлом `server/src/gameStore.ts`: добавить только версионируемую JSON-safe оболочку continuation (`version`, stack `frames` из рекурсивного JSON-типа) как необязательное поле GameEntry. Не добавлять executor behavior, frame semantics/cursors, route wiring и не трогать тесты. DONE: diff только в указанном файле; данные оболочки проходят JSON.stringify/parse без потери; `cd server && npm test -- --runInBand --silent` exit 0; `cd server && npx tsc --noEmit` exit 0. После проверки этот мини-этап закрывается; следующий отдельный handoff — Тестировщику на узкий round-trip тест envelope, затем отдельный этап для первого frame-вида. Если оболочка не проходит оба гейта/требует затронуть другие production files, исполнитель сразу BLOCKED с конкретной причиной, не расширяет scope.
