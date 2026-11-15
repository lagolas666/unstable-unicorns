# MEMORY.md — Краткосрочная память проекта

> Читать **перед началом** любой сессии.
> Обновлять: когда задачи завершены, баги найдены, архитектурные решения приняты.

---

## Текущий статус (14.11.2026, V7-4: отложена механика жертвы)

**Продолжение V7-4 draw continuation (15.11.2026):** этап 1 schema-only принят Аналитиком как промежуточный результат (`JsonValue`, `ContinuationEnvelope version:1`, optional `GameEntry.continuation`; runtime без изменений). Этап 2 принят после независимой проверки `server/src/engine/continuation.ts` и `server/test/continuation.test.ts`: typed plain-data frame union (Play/Effect/Action/Trigger/Draw), pure stack/cursor helpers, strict envelope/frame parser и JSON round-trip; runtime не подключён. Свежие проверки из `server/`: целевой Jest — 1 suite, 11/11 passed; `npx tsc --noEmit` — exit 0. Полный Jest — 67/68 suites прошли, 586 passed / 2 failed / 4 skipped; оба ожидаемых RED `v74ExecutorDrawTrigger.test.ts` (строки 57, 138), вне scope этапа 2; Jest сообщил о незавершённых async operations. Следующий изолированный этап — чистые DrawFrame lifecycle helpers, принятые 15.11.2026; после них отдельно draw suspend/resume и PlayFrame/service. Для этапа 4 свежие независимые проверки: целевые Jest 3 suites / 27 tests PASS, `npx tsc --noEmit` exit 0; полный Jest 69/70 suites, 602 passed / 2 failed / 4 skipped, оба ожидаемых RED `v74ExecutorDrawTrigger.test.ts:57,138`, Jest сообщил о незавершённых async operations. Runtime/service остаются вне принятого scope. Общий `deferredDraw` и official `/draw` не трогать. Shared worktree содержит чужие изменения; whitespace-blocker в `docs/MONETIZATION_AND_AVATARS.md` не исправлять Аналитику без согласования владельца. Незакоммиченные существующие файлы shared worktree не приписывать автору без подтверждения.

**Статус deferred draw V7-4 (15.11.2026):** реализация `on_opponent_would_draw` внутри `kind: draw` остаётся BLOCKED, отдельный тестовый файл `server/test/v74ExecutorDrawTrigger.test.ts` уже существует: контракт (1) JSON round-trip с двумя последовательными draw, (2) вложенный draw из `on_opponent_sacrifices` с продолжением внешнего эффекта. Бэкенд сообщил запуск из `server/`: `npm test -- --runInBand test/v74ExecutorDrawTrigger.test.ts` — EXIT=1, 2/2 теста не прошли (нет окна до draw, второй сценарий мутирует deck до закрытия реакции); изменений файлов со стороны исполнителя нет, полный Jest/tsc не запускались. Причина BLOCKED — scope переноса всей цепочки слишком крупный для одного изменения. Согласована последовательная декомпозиция: (1) plain-data frame union/storage/round-trip invariant без runtime behavior; (2) pump + Trigger/Effect/Action frame infrastructure на существующем engine-independent уровне; (3) draw pre-dispatch/cancel/progress/resume; (4) PlayFrame + обе service дороги pending resolution + queue gating; (5) handoff Тестировщику на расширение сценариев, независимый review и свежие полные гейты. Каждый следующий шаг начинается только после приёмки предыдущего. Общий `deferredDraw` официального `/draw` не трогать. Незакоммиченный backend diff по-прежнему не атрибутировать без подтверждения.

**Статус §1.5 API-контракта (13.11.2026):** остаточный V7-4 раздел `docs/API_CONTRACT.md` актуализирован и сверён с `resolvePendingNow`. Описаны `confirm:true` только с обязательным `byPlayerId` владельца для optional trigger, отказ без confirm и служебный `optional_declined`, `skip` без отдельной семантики, владельцы `chooserId`/`actorId`, выбор карты и формы ответа. Явно отмечено, что отменённый `trigger_effect` (`cancelLevel > 0`) обрабатывается раньше optional-ветки и что обычный trigger исполняется только без отмены. Проверки: семантический checklist раздела — 8 пунктов PASS; `git diff --check -- docs/API_CONTRACT.md` — exit 0. Это принимает только документальный follow-up, не всю V7-4.

**Фаза:** V7-3 полностью принят. По решению Даниила от 14.11.2026 ветка V7-4 про отмену жертвы («Вмешательство») отложена: сложную механику `on_opponent_would_sacrifice` пока не реализовывать; связанную карту не включать в игровую колоду. Карта деактивируется в JSON-каталогах через `active:false` и `deck_count:0`. `on_opponent_sacrifices` остаётся post-success событием; это решение не меняет его семантику и не закрывает остальные независимые пункты V7-4. Точный continuation/pending-контракт и целевые тесты пред-жертвы вернутся на обсуждение при возобновлении. Старый post-success RED в `server/test/v74FollowupTriggers.test.ts` для этого контракта невалиден. Реализация при возврате — data-driven через `kind`/`trigger`, без name-based логики.
**Последние исторические проверки:** `npm test -- --runInBand --detectOpenHandles` — EXIT=0, 65 suites, 566 passed, 4 skipped; Jest сообщил открытый hand-limit Timeout (`schedulePendingResolution` → `openHandLimitWindow` → `endTurn`, `playContract.test.ts:273`). `npx tsc --noEmit` — EXIT=0. Oceloticorn blocker закрыт: name-based fallback удалён, поведение управляется flags; регрессия 6/6, предыдущий полный гейт 66 suites / 572 passed / 4 skipped, TSC 0. **Свежий гейт после снятия невалидного direct-cancel RED (14.11.2026):** `npm test -- --runInBand --silent` — EXIT=0, 66 suites, 572 passed, 4 skipped; Jest предупредил о незавершённых асинхронных операциях после прогона. `npx tsc --noEmit` — EXIT=0. Hand-limit Timeout остаётся отдельным follow-up.
**Ограничение приёмки:** `server/src/gameService.ts` и другие backend-файлы содержат ранее существовавшие незакоммиченные изменения V7-4; рабочее дерево общее, их авторство не приписывать без подтверждения. Текущая V7-4 не принята: контракт согласован, но полный зелёный гейт сам по себе не подтверждает незакрытые целевые контракты V7-4. Отдельно ранее проверенные pull/sacrifice/unicorn-effect/Neigh и data-driven Oceloticorn результаты сохраняются. Jest предупреждение об открытых async operations/hand-limit Timeout вынесено в отдельный follow-up.

**Последний принятый гейт V7-3:** tsc EXIT=0, 63 suites, 541 passed, 4 skipped. Jest EXIT=0.

- V7-3 реализованы 4 kind: prevent/destroy, prevent/on_enter_stable, reactive_trigger, modify_action.
- V7-3 принят ✅.
- Все хардкоды по имени карты отсутствуют.
- Следующий шаг — анализ покрытия и планирование V7-4.

---

## Последние архитектурные решения

| Дата | Решение |
|------|---------|
| 14.11.2026 | По решению Даниила признан невалидным и снят RED на direct `cancel` в post-success `on_opponent_sacrifices`; не вводить no-op без активной цели и не откатывать жертву. Возобновить direct `cancel` только по отдельному контракту/тесту с реально активной stack-целью. | Аналитик |
| 12.11.2026 | V7-2 принят ✅. isPlayPrevented + prevent/play + restrict_action/play_spell+magic работают. Остаток → V7-3. |
| 12.11.2026 | while_in_stable — 5 kind без case в executeAction. Исправлено: prevent (play) и restrict_action получили isPlayPrevented. |
| 05.11.2026 | Малыш — source_zone='nursery_only', isNurseryOnly строго по флагу |
| 05.11.2026 | Хардкод enter-эффектов снесён, драйвер данных — до skipGenericLoop |
| 04.11.2026 | scope — приёмка закрыта, мутация self→[] не просится для sacrifice |
| 03.11.2026 | Карты → чистые данные, движок без сравнений по имени |
| 29.10.2026 | Аналитик решает спорные механики, Codex отключён |
| 28.10.2026 | Основной движок — routes/game.ts, gameInstance (сохранить для ботов) |
| D1b-2: решафл сброса в колоду при доборе (executeDraw) | 11.11.2026 | Аналитик |
| D-2: code в REST-ошибках (400-409, 4 test suites); сокет S19 → nothing_pending | 11.11.2026 | Тестировщик |

---

## Кто за какой файл отвечает (границы владения)

| Файл/папка | Владелец |
|------------|----------|
| server/src/** (кроме test/ и data/) | Бэкенд |
| server/test/** | Тестировщик |
| server/src/routes/game.ts, gameStore.ts | Аналитик |
| server/src/engine/executor.ts | **Бэкенд** (на время V7-2 может перезаписывать целиком) |
| server/data/unicorns.json, catalog.v2.json, routes/unicorns.ts | Аналитик |
| client/src/** | Фронтенд |
| docs/** | Все (пишет своё, обновляет общее) |

---

## Открытые баги

| ID | Описание | Статус |
|----|----------|--------|
| BUG-NM-EXSELF | nightmare_unicorn_ultimate жертвует сам себя (exclude_self не читался при входе) | Закрыт 06.11.2026 |
| BUG-SWAP-05 | Невозможный обмен → нет 409, карта играется бесцельно | Закрыт 07.11.2026 |
| D5 | 128 action-селекторов из каталога не читались (читали .from/.source а каталог даёт .target) | Закрыт |
| #50 | draw_card работает только в фазе begin_turn, не проверяет playerId | Открыт, низкий |
| Мохибейк | 18 строк cp1251-мусора в gameService.ts (комментарии) | Открыт, косметика |

---

## Последние значимые коммиты

- `9d1bcfa` — HEAD (03.11.2026, история переписана)
- Система бэкапов: файлы `.prev_*` в server/src/client/src

---

## Ключевые номера

- RED-тесты (M-мутация): падающий ассерт с текстом ошибки, не просто toBeDefined
- Мост: после ~14 команд → STATUS; обрыв → продолжать без разрешения
- База: MongoDB 8.0.14 на 127.0.0.1:27017, uu_new
- Effect coverage: 43 kind (22 live, 21 NIKTO), 19 triggers (7 live, 12 NIKTO)
## 12.11.2026 — V7-4: dispatchTrigger + on_opponent_* (@Единорог Бэкенд)
- `server/src/engine/executor.ts`: новый `dispatchTrigger(ctx, actorId, event)` — data-driven скан стабильов по `effects[].trigger === 'on_opponent_*'` (без хардкодов имён); condition/while_source_in учитываются. Опасные (destroy/steal/sacrifice/force_discard), stack-scope, uncounterable → окно реакции (pending `trigger_effect` через `requestReactionWindow`, расширен триггерами on_opponent_* + флагом `optional`); безопасные не-optional → немедленный `resolveEffect`; optional → окно без автоисполнения.
- `server/src/gameService.ts`: в `performPlayNow` после резолва карты диспетчеризация событий из ТИПА карты (`on_opponent_play`, `on_opponent_plays_unicorn` (isUnicornCard), `on_opponent_plays_upgrade_downgrade`, `on_opponent_plays_spell` (magic), `on_opponent_plays_neigh` (instant+subtype neigh)); в `pendingTimeout` + `resolvePendingNow` для optional-окон: исполнение только при `confirm: true` от владельца, иначе отказ (лог `optional_declined`).
- Доказательства: `npx tsc --noEmit` → exit 0; `npm test` → 63/63 suites, 541 passed / 4 skipped, exit 0.
- Контракт: `docs/API_CONTRACT.md` — `PendingAction.optional` (+семантика confirm/skip).
- Статус: обновлены фикстуры `DK1/DK2`, подтверждение/skip требуют `byPlayerId`, отказы без/с чужим владельцем дают 400; очередь проверяется до полного дренажа. Гейт 13.11: целевой тест 13/14 (единственный RED — `on_opponent_plays_unicorn` через прямой `/play`), полный Jest 63/64 suites, 554 passed / 4 skipped; `npx tsc --noEmit` exit 0. Баг передан Бэкенду: событие unicorn отсутствует на прямом пути `/play` после недавнего подключения `playCard`.
- Контракт: `docs/API_CONTRACT.md` — `PendingAction.optional` (+семантика confirm/skip).
- Статус: Бэкенд сообщил DONE для прямого `/play`: исправлены аргументы `isUnicornCard` на прямом и отложенном путях в `gameService.ts`; целевые 14/14, полный Jest 555 passed / 4 skipped (64 suites), `npx tsc --noEmit` exit 0. Это пока не принято Аналитиком: нужны независимая проверка diff и свежий гейт; Jest сообщил об открытых асинхронных операциях.
- Статус: маршрутный follow-up `/playWithTargets` независимо принят Аналитиком: исправление в `server/src/routes/game.ts` диспатчит события по типу карты после успешного розыгрыша; целевой тест `npm --prefix server test -- --runInBand test/onOpponentTriggers.test.ts` → 14/14, полный `npm --prefix server test -- --runInBand` → 64 suites, 555 passed, 4 skipped, `Set-Location server; npx tsc --noEmit` → exit 0. В обоих запусках Jest сообщает об открытых async-операциях. Полная V7-4 остаётся в работе/на проверке; приёмка этого follow-up не означает закрытие всей V7-4.
- Решение тимлида, 13.11.2026: следующий шаг после исправления прямого `/play` и `/playWithTargets` — не начинать новую фичу, а отдать V7-4 на независимый аудит Тестировщику. Аудит должен проверить покрытие событий и типов карт, поведение optional confirm/skip и владельца окна, последовательность нескольких реакций, отсутствие хардкодов по имени карты; отдельно локализовать или оценить предупреждение Jest об открытых async-операциях. До аудита V7-4 не закрывать. После ответа — независимая приёмка Аналитиком и только затем либо закрытие V7-4, либо точечные follow-up.

- Независимый аудит V7-4 (13.11.2026): базовые optional confirm/skip и очередь подтверждены зелёным полным Jest (64 suites, 555 passed, 4 skipped, exit 0), но задача BLOCKED: четыре on_opponent trigger без dispatch source; reactNeigh не диспатчит on_opponent_plays_neigh; найдены сравнения по имени Elusive Oceloticorn; один Jest Timeout локализован в hand-limit таймере. Детали/ограничения — docs/qa-V74-onOpponentTriggers.md. Исходники не менялись.


## 13.11.2026 — Решение по follow-up V7-4 после независимого QA
- Даниил согласовал полный scope: подключить источники для `on_opponent_would_draw`, `on_opponent_pull_baby`, `on_opponent_sacrifices`, `on_opponent_unicorn_effect`; добавить dispatch `on_opponent_plays_neigh` после успешной реакции Neigh; убрать сравнения по имени Elusive Oceloticorn (перевести поведение на данные/общий флаг).
- До реализации четырёх событий требуется согласовать семантику и точные точки dispatch, особенно `would_*`; затем реализация, независимые контрактные тесты, свежий полный Jest и `tsc --noEmit`. V7-4 не закрывать до прохождения приёмки.
- Jest Timeout локализован в hand-limit (`endTurn → openHandLimitWindow → schedulePendingResolution`, `playContract.test.ts:273`): вести отдельным follow-up, вне текущего V7-4 scope.
- Основание: `docs/qa-V74-onOpponentTriggers.md`, QA BLOCKED. Сообщённые проверки: 64 suites, 555 passed, 4 skipped, exit 0; `npx tsc --noEmit` exit 0; `git diff --check` exit 0. Полный Jest в сохранённом отчёте свежий; целевой набор и TypeScript в аудите отдельно не повторялись.


## 13.11.2026 — Семантика V7-4 follow-up согласована Аналитиком
- `on_opponent_*`: `actorId` — игрок, чьё действие породило событие (добирающий / жертвующий / получающий Малыша / исполняющий эффект), не владелец карты-реакции; диспетчер исключает именно этого актора.
- `on_opponent_would_draw`: источник — официальный добор из `gameService.drawCard` и эффекты `kind: draw` в `executor.executeDraw`; событие должно быть до изменения колоды/руки. Контракт должен сохранить отложенный добор: при реакции исходный draw продолжается, если не отменён, и не происходит при отмене; простого создания pending недостаточно.
- `on_opponent_pull_baby`: игровое перемещение Baby из общего `state.nursery` в stable после старта партии (например, эффектом `add`); начальная раздача Baby при создании партии не событие. Отдельного общего gameplay API pull сейчас нет; не путать `executePull` (крадёт случайную карту из руки) с Nursery.
- `on_opponent_sacrifices`: событие после фактического успешного выполнения sacrifice action (хотя бы одна карта реально перемещена), actor — игрок, оплативший/выполнивший жертву; учитывать и costs, и эффекты, не запускать на неудачной/нулевой попытке.
- `on_opponent_unicorn_effect`: только после успешного разрешения эффекта карты, классифицированной `isUnicornCard`; не генерировать рекурсивное событие от самого `on_opponent_*`-эффекта. Actor — исполнитель эффекта. Не dispatch при отмене/провале.
- `on_opponent_plays_neigh`: после принятой реакции, когда Neigh-family карта удалена из руки и добавлена в discard (не при неудачной попытке); actor — реагирующий игрок. Покрыть actual route/service flow, а не только обычный розыгрыш instant.
- Ocelotcorn: каталог хранит `static_properties.blocks_neigh_for_others` и `static_properties.cannot_be_neighed`; канонический ключ — `blocks_neigh_for_others` (с s). Общая загрузка/нормализация статических флагов должна делать поведение data-driven; убрать name fallback/сравнения, не вводить другое имя-специфичное исключение. `gameService` уже проверяет общий флаг, но сохраняет Ocelotcorn-specific helper/comment; `routes/game.ts` сейчас читает неверный `block_neigh_for_others` и имеет name fallback.
- Независимый QA ранее зафиксировал базовые V7-4 сценарии зелёными, но полная V7-4 остаётся открытой. Hand-limit Jest Timeout — отдельная задача, вне этого follow-up.


## 13.11.2026 — Backend приостановлен до RED-гейта V7-4 follow-up
- Backend сообщил `BLOCKED`: по принятому TDD-процессу для реализации нужны проверенные RED-тесты; папка `server/test/**` принадлежит Тестировщику. Исходники не менялись, тесты не запускались.
- Следующий шаг: Тестировщик пишет RED-контрактные тесты по согласованному scope (would-draw продолжение/отмена; игровой перенос Nursery Baby; sacrifice costs/effects; unicorn effect; принятая Neigh; data-driven `blocks_neigh_for_others`) и предоставляет целевой запуск с ожидаемыми падениями отсутствующей функциональности. После RED-гейта Backend продолжает реализацию. Jest hand-limit Timeout остаётся вне scope.


## 13.11.2026 — RED-гейт V7-4 follow-up передан Бэкенду
- Тестировщик сообщил: `server/test/v74FollowupTriggers.test.ts` — 8 failing / 1 passing; полный Jest — 64 suites passed, 1 новый failed, 556 passed / 4 skipped; `cd server && npx tsc --noEmit` — exit 0. Падения ожидаемо соответствуют отсутствующим контрактам, но это отчёт исполнителя тестового гейта, не приёмка реализации.
- Аналитик снял блокировку и передал Бэкенду ход для реализации в `server/src/**`; тесты не менять. После реализации обязательны независимая проверка Тестировщиком и свежий полный Jest + `tsc --noEmit`. V7-4 остаётся открытой; hand-limit timeout вне scope.


## 13.11.2026 — Возобновление передачи V7-4 follow-up после сбоя моста
- Бэкенд сообщил BLOCKED: чтение `docs/PROJECT_MAP.md` вернуло `interrupted`; затем он ошибочно вызвал чтение `docs/MEMORY.md` и загрузку TDD-инструкций. По его отчёту файлы не изменялись, тесты не запускались. Аналитик повторно прочитал карту и память: активная задача и scope без изменений.
- По просьбе Даниила Бэкенду повторно передаётся ход на продолжение реализации. После передачи Аналитик не использует инструменты до DONE/BLOCKED.

## 13.11.2026 — V7-4: уточнение deferred draw / Neigh / deck-empty
- `on_opponent_would_draw` возникает до исходного добора. Его собственная реакция может отменить исходный добор через `cancel` стека; простое подтверждение/отказ реакции не должно менять факт добора.
- Neigh, применённая к pending-реакции, отменяет эту реакцию, а не исходное действие `would_draw`; после закрытия Neigh исходный добор продолжается. Поэтому тест, ожидающий отсутствия draw после Neigh, неверен.
- Fixture реакции `add(deck→hand)` некорректен для проверки продолжения draw: он сам потребляет `TOP_CARD` до исходного добора. Использовать пустое/не затрагивающее deck действие для непрерывающего сценария; отдельный cancel-сценарий должен тестировать фактическую отмену draw.
- Если завершение уже начатого действия открыло pending, существующее pending-разрешение и связанные с ним queued reactions завершаются до фиксации победителя по пустой колоде/сбросу. Не допускать 409 `game over` на confirm, пока pending ещё обязан разрешиться; после дренажа применить обычное условие победы. Этот контракт требует воспроизводимого теста на pending + deck/discard empty.


## 13.11.2026 — Правило Neigh для `trigger_effect`
- Решение Аналитика: `Neigh` не отменяет исполняемый/ожидающий триггерный эффект — он применим к попытке другого игрока сыграть карту, а не к эффекту карты из стойла. Следовательно, владелец собственного `on_opponent_would_draw` окна не может разыграть Neigh, чтобы отменить этот же триггер; более того, Neigh не используется на `trigger_effect` ни владельцем, ни третьим игроком. Сам добор продолжается, если не отменён поддержанным эффектом `cancel`.
- Тест `v74FollowupTriggers.test.ts` «Neigh cancels only the pending would-draw reaction» задаёт несовместимое с правилом поведение и должен считаться неподтверждённым/требующим решения по тестовому контракту; Бэкенду не менять правила движка ради прохождения такого кейса.
- Статус реализации по сообщению Бэкенда: незавершённые изменения `server/src/gameService.ts`; целевой набор 10/11; `npx tsc --noEmit` EXIT=0; полный `npm test` прерван (`interrupted`), `cancel` пока unhandled. V7-4 не принят.


## 13.11.2026 — Очередность после гейта с `cancel`
- После свежего полного Jest от Бэкенда выявлены два неверных/устаревших тестовых ожидания (Neigh на `trigger_effect`, F9 имя-карта) и `unhandled action kind: cancel`; 564 passed, 4 skipped, 2 suites/2 tests failed, 63 suites passed, exit 1. TSC у этой сводки не приведён.
- **Обновление 14.11.2026:** В активную работу передан Тестировщику test-only RED-гейт: скорректировать прямой `cancel` по свежим результатам и синхронизировать Nursery count проверки с каталогом, где карта отключена (`active:false`, `deck_count:0`), не трогая `server/src/**` и отложенную пред-sacrifice ветку. После DONE Аналитик независимо проверяет тестовый diff и целевой/полный гейт; затем передаёт узкую реализацию direct `cancel` Бэкенду. Свежий исходный полный прогон: 2 suites failed, 64 passed; 4 failed, 569 passed, 4 skipped; три Nursery assertions ожидали 276 активных копий, получили 275; один RED на `unhandled action kind: cancel`; TSC exit 0. Ранее переданный Test-only блокер актуализирован под состояние общего рабочего дерева.


## 13.11.2026 — Регрессия Ocelotcorn / Neigh после проверки Аналитиком
- Добавлен `server/test/ocelotcornNeighFlags.test.ts` (HTTP): `/playWithWindow` проверяет top-level и `static_properties.cannot_be_neighed`; `/react/neigh` проверяет top-level и `static_properties.blocks_neigh_for_others`; отдельный случай использует фактическую запись Ocelotcorn из `loadCatalogFixture()` и проверяет оба каталожных флага; карта с похожим именем без флагов остаётся Neighable и не блокирует ответную Neigh.
- Целевой Jest: 1 suite, 6/6 тестов, exit 0. Полный Jest: 66/66 suites, 572 passed, 4 skipped, exit 0. `Set-Location server; npx tsc --noEmit` — exit 0.
- Полный Jest повторно вывел предупреждение об открытой асинхронной операции/таймере после завершения; тестовые suite завершились успешно, предупреждение отдельного hand-limit follow-up не расследовалось.
- В этот проход backend исходники не менялись; мутационное RED-подтверждение не выполнялось.

- **13.11.2026 — следующий ход V7-4:** Передать Тестировщику строго `server/test/**`: скорректировать Neigh-тест, так как Neigh не отменяет `trigger_effect`; обновить устаревшее F9-ожидание на data-driven `blocks_neigh_for_others`; добавить узкий RED-контракт прямого `cancel`, подтверждающий отказ текущей реализации с `unhandled action kind: cancel`. После DONE Тестировщика только затем передать Бэкенду реализацию. Рабочее дерево общее и содержит несвязанные незакоммиченные изменения; исходники не трогать. V7-4 остаётся открытой, hand-limit Timeout — вне scope.


## 13.11.2026 — Уточнена продуктовая семантика cancel («Вмешательство»)
Даниил подтвердил правило: карта «Вмешательство» играется, когда другой игрок пытается пожертвовать карту; отменяется именно попытка пожертвования до её применения и до любых триггеров от успешной жертвы, после чего выполняется выбор игрока и собственное действие (пожертвовать или уничтожить карту в его Конюшне). Если эта жертва была стоимостью входа единорога, отменённое пожертвование не происходит, а разыгрываемый единорог уходит в сброс. Если эффект требует пожертвовать несколько карт, вмешательство применимо только к первой карте. Нельзя отменять уже завершённую жертву или сам `trigger_effect`. Поэтому имеющийся RED-кейс `on_opponent_sacrifices` после успешной жертвы не является корректной проверкой этого правила и подлежит пересмотру; не подавлять `unhandled action` без реализации семантики отмены попытки. Поведение должно быть data-driven (`kind`/`trigger`), без хардкодов имени карты.


**Уточнение поверх записи текущего статуса выше (13.11.2026):** «Вмешательство» не отменяет уже выполненное событие `on_opponent_sacrifices`. Источник отмены — сама попытка пожертвовать карту, до её перемещения и вызова триггеров. Правила стоимости единорога и нескольких жертв указаны выше и являются авторитетным контрактом; прежний RED после успешной жертвы не использовать как валидный гейт.


## 13.11.2026 — V7-4: уточнён пред-sacrifice контракт (отложен 14.11.2026)
Даниил утвердил отдельный пред-событийный trigger `on_opponent_would_sacrifice` для окна «Вмешательства»; `on_opponent_sacrifices` остаётся событием только после фактически успешного пожертвования. Отмена должна происходить до перемещения жертвы и её триггеров; отмена стоимости входа отправляет единорога в сброс; отмена первой жертвы прекращает много-карточный эффект. Решением от 14.11.2026 реализация этой сложной механики отложена, а карта временно выключается из игровой колоды. Контракт и тесты остаются справочными для будущего возобновления. Старый post-success RED на `on_opponent_sacrifices` невалиден.


## Решение по V7-4 `kind: draw` continuation (14.11.2026)
Выбран ограниченный, сериализуемый continuation только для draw-цепочки executor: диспетчеризовать `on_opponent_would_draw` до мутации deck/hand; пока pending-окно не разрешено, не выполнять последующие действия. Сохранить курсор последовательности и прогресс получателей/доборов. После окна выполнить или отменить только соответствующий единичный добор, затем возобновить остаток доборов и действий ровно один раз. Требуются тесты порядка, нескольких получателей/доборов, отмены конкретного draw и возобновления без пропуска/повтора. Не входит: общий continuation framework, вложенные/параллельные deferred effects, пред-sacrifice и общий executor cancel; правила существующих окон не менять. Карты остаются data-driven через `kind`/`trigger`, без name-based условий. Это проектное ограничение принято Аналитиком после BLOCKED Бэкенда; запрос пользователю о выборе объёма не получил ответа до таймаута. При новых требованиях уточнить контракт до расширения scope.


### 14.11.2026 — Смена scope V7-4 draw continuation
- Даниил утвердил расширение: сериализовать и приостанавливать всю внешнюю цепочку `play`, не только текущий effect cursor; после pending + `pendingQueue` продолжать каждый шаг ровно один раз. Исполнитель обозначил два пути play в `gameService.ts` и вложенные resolve-вызовы в executor, где синхронный call stack содержит незавершённые циклы/побочные эффекты.
- Архитектура согласована Аналитиком: явный plain-data LIFO stack типизированных frames `PlayFrame`, `EffectFrame`, `ActionFrame` (конкретные variants на каждый незавершённый caller), `TriggerFrame`, `DrawFrame`. Перед push дочернего frame родитель записывает next cursor и состояние до/после вызова; frame хранит только сериализуемые IDs/индексы/enum/plain values и агрегаты исхода (`prevSucceeded`, `anySucceeded`, draw recipient/progress, trigger scan cursor/prompts). Функции, замыкания, Promise и `ResolveContext` запрещены в persisted state. Pending блокирует interpreter целиком до дренажа очереди. Реализовывать инкрементально: schema/storage → draw/trigger/effect/action caller frames → оба service play pipeline включая cleanup и post-play dispatch → RED-регрессии exact-once/order/cancel конкретного draw/nested/resume восстановленного состояния.
- Scope охватывает только достижимый draw/play continuation, не произвольную универсальную систему deferred effects. Официальный `/draw`/`deferredDraw`, правила окна, общий `cancel`, пред-sacrifice и name-based поведение не менять. `server/test/**` принадлежит Тестировщику; Backend не редактирует без отдельного handoff/RED.
- Текущие доказательства до реализации: целевой тест 7 failed, exit 1; Backend сообщил, что патчей не вносил; полный свежий Jest и TSC после изменений отсутствуют. Задача открыта, не принята. Не приписывать ранее существующие dirty changes исполнителю без подтверждения.


## 15.11.2026 — RED-regрессии nested draw continuation
- Тестировщик сообщил о завершении диагностического этапа и BLOCKED на двух RED в новом `server/test/v74ExecutorDrawTrigger.test.ts`; production-файлы не тронуты, временный probe удалён. Доказательства по отчёту: валидный `play(..., { targets: [sacrifice] })` → 200, жертва происходит до optional post-success `on_opponent_sacrifices` окна владельца; затем тест nested-сценария видит расход deck до ожидаемого `on_opponent_would_draw` pending, а JSON round-trip после `play` не восстанавливает ожидаемое `trigger_effect` и получает `pending` undefined. Целевой Jest RED; полного Jest и TSC после этой регрессии нет.
- Сопоставление с утверждённым scope в `PROJECT_MAP.md` и решением 14.11: `kind: draw` обязан dispatch `on_opponent_would_draw` до изменения deck/hand, приостанавливать и сериализуемо сохранять всю внешнюю `play` цепочку до дренажа pending/queue. Поэтому наблюдения — незакрытые production-дефекты/этап continuation, а не основание ослаблять тестовые ожидания. Передано Бэкенду расследовать оба пути и продолжить реализацию только в `server/src/**`; тестовый файл не менять. Независимая приёмка Аналитиком обязательна, V7-4 остаётся открытой.


## 15.11.2026 — Frame schema отложена до полного caller-инвентаря
Бэкенд сообщил BLOCKED: обнаружены дополнительные достижимые вложенные продолжения вне первоначального набора Play/Effect/Action/Trigger/Draw — вход в стойло, уничтожение, поиск/перемещение и жертва; локальные cursor/stage/accumulator этих веток ещё не перечислены. Поэтому не утверждать достаточность union и не начинать schema/storage implementation. Следующий этап — read-only инвентаризация достижимого play/draw пути: каждая точка вызова/возврата, незавершённый родительский цикл, точное локальное состояние, требуемое для продолжения, значения vs ссылки, взаимодействие pending/pendingQueue; указать файлы/функции и доказательные диапазоны строк/уникальные anchors. Не менять файлы и не запускать тесты; не включать официальный `/draw`/`deferredDraw`, пред-sacrifice/general cancel или arbitrary deferred effects. После отчёта Аналитик определит минимальный безопасный scope следующей реализации. Независимый аудит и свежие гейты требуются только при последующем изменении кода.


## 15.11.2026 — Частичный BLOCKED по caller inventory
Первый read-only отчет Бэкенда полезен, но не доказывает полноту: найден отдельный `POST /:id/playWithTargets` (`server/src/routes/game.ts`, заявлены строки 801–918), не установлена его достижимость в draw-continuation scope; не проверена достижимость повторных `case 'sacrifice'` и `case 'destroy'` в `executor.ts`; общая маршрутизация play roots и оставшиеся child-return/mutation paths требуют подтверждения. Не утверждать завершённость inventory/union. Следующий handoff должен закрывать эти конкретные вопросы: статически проследить route/dispatcher до root и доказать включение/исключение по критерию достижимого `kind: draw` → pending; проверить switch ветви и их вызывающие пути; сообщить anchors, точки вызова/возврата и требуемые continuation values для включённых callers. Только read-only, без кода/тестов; любые новые пробелы перечислить точно и не выдавать DONE без доказательства полноты.


## 15.11.2026 — Проверка `playWithTargets` и повторных ветвей
Независимо проверены anchors отчёта Backend: `server/src/index.ts:50` монтирует router на `/api/game`; `routes/game.ts:671` регистрирует `POST /:id/playWithTargets`; прямая ветка :801–918 разрешает costs, удаляет карту из руки, проходит `on_play`/`immediate` через `resolveEffect`, затем завершает play. Для соответствующего `kind: draw` путь идёт через `executeAction` к `executeDraw`; тело `executeDraw` :1340–1380 меняет deck/hand и не делает `on_opponent_would_draw` dispatch. Явный dispatch в `gameService.ts:1118` расположен только в отдельном deferredDraw flow. Значит route включается в будущий согласованный draw-continuation inventory после внедрения interception, но pending от nested draw сейчас там не создаётся. В `executor.ts` исполняющий switch содержит ранние destroy :1417–1491 и sacrifice :1533–1605 с завершающими `return`; повторные :2151 и :2179 недостижимы. Feasibility case около :788/:797 относятся к отдельному `isActionPossible` switch. Результат закрывает только эти вопросы, не полный caller inventory и не достаточность frame union. Никакие тесты не запускались, файлов кода не менял.


## 15.11.2026 — Результат расширенного read-only caller-аудита (неполный)
Бэкенд перечислил локальные continuation-состояния для `resolveEffect`/`resolveActions`/`dispatchTrigger`, enter/destroy effects и data-driven child paths через pull baby, destroy, sacrifice, move/give/return/transfer/steal, search, `mill_until` и `draw_conditional`. Отчёт подтверждает, что после child остаются cursors, стадии, accumulators и снимки; closures, runtime references, event listeners и `Map` нельзя сохранять как обычный JSON без восстановления/кодирования. `playWithTargets` требует сохранения своего route/context после child-pending; pending + `pendingQueue` должны быть согласованы до возобновления pump. Это полезный перечень, но не доказательство полного caller inventory или достаточности frame union; код/документы исполнителем не менялись, тесты не запускались (по его отчёту).

Открытые границы перед любой schema implementation: (1) установить, какие roots вне стандартных service play flows достижимо приводят к `kind: draw` → будущему `on_opponent_would_draw` pending, в частности `playWithTargets`, dispatcher/turn-start прямые `resolveEffect` и реакционный `on_opponent_plays_neigh`; (2) для включённых roots проследить до всех post-child возвратов и указать cursor/stage/accumulators; (3) явно зафиксировать roots вне согласованного scope. До ответа frame union/storage остаются отложены. Следующий шаг — точечный read-only аудит только этих пробелов; не менять `server/src/**`, `server/test/**` и текущую архитектурную границу `/draw`/`deferredDraw`, arbitrary deferred effects и пред-sacrifice/general cancel.


## 15.11.2026 — Самостоятельная проверка roots после BLOCKED инструментального вызова
Read-only проверены дополнительные пути, чтобы не повторять прерванную передачу Бэкенду. `playWithTargets` — прямой игровой root с costs через `resolveActions`, effects через `resolveEffect` и route-tail после child-вызовов (placement/discard, `dispatchTrigger`, AP, ответ); маршрут включён в будущую draw-continuation область, если/когда `kind: draw` будет перехватываться до изменения deck/hand. Сейчас `executeDraw` :1340–1380 синхронно меняет deck/hand без `on_opponent_would_draw` pending.

Turn-start roots: `/turnStart` → `triggerTurnStartEffects` :217+ → прямые `resolveEffect` внутри вложенных zone/card/effect циклов; `/turnStart/activate` и `/turnStart/choose` тоже вызывают `resolveEffect` напрямую. Данные эффектов могут содержать `kind: draw`, но текущий draw не открывает would-draw pending. Neigh roots: `playWithTargets`/обычные play dispatch-ят `on_opponent_plays_neigh`; `reactNeigh` dispatch-ит его после оплаты instant и изменения cancelLevel. Ветка разрешения `trigger_effect` создаёт `ResolveContext` вручную (`gameService.ts:2437+`), а не через `ctxFor`, значит не получает `requestReactionWindow`; если этот root должен поддержать новый вложенный would-draw pending, callback и поведение относительно существующего pending/pendingQueue надо решить явно.

Это закрывает только названные roots, не полный caller inventory и не frame-union design. Не менялись код/тесты; новые тесты и Jest/TSC не запускались. Осталось: полный граф достижимых callers и post-child cursors/cleanup, context callback на resume и scope исключённых roots. Frame schema/storage остаются отложенными до отдельной архитектурной фиксации; официальный `/draw`/`deferredDraw`, arbitrary deferred effects, пред-sacrifice/general cancel вне текущей границы.


## 15.11.2026 — Декомпозиция V7-4 по просьбе Даниила
Чтобы не удерживать одну задачу днями и не продолжать широкий аудит, ближайший шаг ограничен schema-only изменением одного файла: `server/src/gameStore.ts` получает необязательный versioned JSON-safe continuation envelope (`version` + `frames` рекурсивного JSON-типа) в GameEntry. Это только контейнер хранения, не готовая frame union и не runtime continuation. Исполнитель не трогает executor/routes/tests; DONE только при JSON round-trip примера, diff только в `gameStore.ts`, свежих `npm test -- --runInBand --silent` и `npx tsc --noEmit` из `server/` с exit 0. Следующий этап отдельный: Тестировщик добавляет короткий envelope round-trip test; после независимой проверки будет передана только одна следующая frame/infrastructure задача. Любое препятствие сообщить как BLOCKED сразу с причиной и вариантом узкого сужения, не расширять этап.


**Приёмка V7-4 schema-only этапа 1 (15.11.2026):** независимо принято только добавление типизированного plain-data storage-контракта: `JsonValue`, `ContinuationEnvelope { version: 1; frames: JsonValue[] }`, optional `GameEntry.continuation`. Это не реализует сохранение/возобновление runtime эффекта и не закрывает V7-4. Свежие проверки из `server/`: `npx tsc --noEmit` — EXIT=0; `git diff --check -- server/src/gameStore.ts` — EXIT=0; полный `npm test -- --runInBand --silent` — EXIT=1, 66 suites passed / 1 failed, 575 passed / 2 failed / 4 skipped. Два RED воспроизведены в `v74ExecutorDrawTrigger.test.ts:57,138` и требуют последующих runtime-этапов, не входят в schema-only контракт. В diff `gameStore.ts` также есть `pendingQueue`/`QueuedReaction`, которые не приписываются этому этапу без подтверждённого авторства. Ограничение контракта: тип `number` и compile-time JSON shape не валидируют NaN/Infinity/циклы во время выполнения; runtime-проверка остаётся будущей задачей записи/сериализации.

**V7-4 этап 3 pump infrastructure (15.11.2026, в работе):** узкий этап только `server/src/engine/continuation.ts` и новый отдельный backend test-файл; `server/test/continuation.test.ts` не менять, runtime-файлы (`executor.ts`, `gameService.ts`, `gameStore.ts`) не трогать. Добавить engine-independent pump step/guard API: только верхний кадр, максимум одно решение/переход на вызов; pending либо непустая pendingQueue дают Blocked без изменения continuation; pending отсутствует и очередь пуста — разрешить обработку одного верхнего кадра; пустой stack — Complete. Реализация не вызывает gameplay handlers и не подключает draw/play runtime. DONE после целевых новых и существующих helper-тестов + `npx tsc --noEmit` exit 0; последующие draw suspend/resume и PlayFrame/service остаются отдельными этапами. Shared worktree; ранее существовавшие изменения не атрибутировать.


**15.11.2026 — Приёмка V7-4 этапа 3 (pump infrastructure):** аналитик независимо проверил `server/src/engine/continuation.ts` и новый `server/test/continuationPump.test.ts`. `pumpStep` чисто блокирует pump при active/queued pending, сообщает complete для пустого стека или только верхний кадр; runtime не вызывает и continuation не мутирует. Свежий целевой Jest: `continuation.test.ts` + `continuationPump.test.ts` — 2 suites / 16 tests passed; `npx tsc --noEmit` — exit 0; scoped `git diff --check` — exit 0. Полный Jest: 68/69 suites, 591 passed / 2 failed / 4 skipped; оба RED — `v74ExecutorDrawTrigger.test.ts:57,138`, плюс предупреждение async operations. Отдельный diff-check чужого `docs/MONETIZATION_AND_AVATARS.md` остаётся exit 2 из-за trailing whitespace; файл не менялся. Принят только этап pump infrastructure, не runtime continuation и не V7-4 целиком. Следом — этап draw pre-trigger/cancel/progress/resume, затем PlayFrame/service.


## 16.11.2026 — V7-4 draw runtime BLOCKED: scope требует решения
Переданный Бэкенду draw pre-trigger этап остановлен как BLOCKED без code changes. Его read-only анализ и targeted Jest `v74ExecutorDrawTrigger.test.ts` (2 failed, exit 1) показывают, что интеграционные acceptance требуют сохраняемого cursor родительского `resolveEffect` для nested draw и подключения `requestReactionWindow`/continuation к обоим service `trigger_effect` pending paths (`resolvePendingNow` и timeout); один DrawFrame/pump или hook в `executeDraw` не обеспечит JSON restore и порядок. Это шире явно ограниченного этапа. Полный Jest/tsc Бэкенд не запускал. PROJECT_MAP отмечен BLOCKED. До нового решения не расширять задачу: Даниил выбирает (A) отдельный ограниченный runtime continuation этап с effect cursor и обоими pending-path, затем draw hook; (B) сузить этап до изолированных helpers, оставив integration RED вне acceptance. Официальный `/draw`/`deferredDraw`, arbitrary deferred effects, пред-sacrifice/general cancel остаются вне scope.


## 16.11.2026 — Решение Даниила: вариант B для V7-4 draw-trigger
Даниил выбрал узкий scope B. Runtime-интеграцию `on_opponent_would_draw` в `executeDraw`/effect continuation/service pending не выполнять; отдельная helper-задача не нужна, так как чистые DrawFrame lifecycle/helpers уже приняты (этап 4). Оба targeted integration RED `v74ExecutorDrawTrigger.test.ts` остаются известными, вне helper-only acceptance: JSON restore последовательных доборов и nested ordering требуют сериализуемого effect cursor + двух service pending paths. Бэкенд подтвердил BLOCKED до решения, code changes не делал; targeted Jest 2 failed / exit 1, полный Jest и tsc не запускались. Продолжать только после отдельного решения о runtime continuation scope.


## 16.11.2026 — Handoff и состояние Git для нового группового чата
Вариант B по V7-4 draw-trigger подтверждён: runtime draw continuation отложена; этапы инфраструктуры 1–4 приняты только в своих ограниченных границах; два targeted integration RED `v74ExecutorDrawTrigger.test.ts` остаются известными вне текущего scope. Бэкенд подтвердил остановку без code/test changes и без дополнительных проверок. Подробная сводка нового чата — `docs/HANDOFF_2026-11-16.md`.

Git проверен 16.11.2026: текущая `main` (default) ahead `origin/main` на 2 коммита (`b47d892`, `0a399b4`); staging пуст, worktree содержит 15 tracked modifications и 14 untracked files, включая изменения backend, data, tests и документы с неустановленным авторством. `git diff --check` сообщает trailing whitespace в чужом/неподтверждённом `docs/MONETIZATION_AND_AVATARS.md`. По правилу команды нельзя push в default branch; смешанный worktree нельзя коммитить/публиковать как единый проверенный набор. Дальнейшая публикация требует отдельной feature branch и решения Даниила о разделении/владельцах файлов. Не атрибутировать и не исправлять чужие изменения без подтверждения.


## 16.11.2026 — Публикация общего worktree по разрешению Даниила
Даниил явно разрешил публиковать весь текущий общий worktree, включая изменения, которые могли быть сделаны в других групповых чатах. Для этого создана ветка `feature/v74-worktree-handoff-2026-11-16` от локального HEAD `b47d892`; публикация допустима только в feature-ветку, не в `main`. Свежие гейты из `server/`: `npx tsc --noEmit` exit 0; `npm test -- --runInBand` — 69/70 suites passed, 602 passed / 2 failed / 4 skipped (оба RED `v74ExecutorDrawTrigger.test.ts:57,138`, draw-trigger runtime; Jest open async operations). Полный `git diff --check` сообщает trailing whitespace в markdown-документах (включая строки hard-break); scoped check выбранных backend/docs/tests paths проходил. По прямому разрешению Даниила допускается публикация всего общего набора в feature-ветке, но опубликованный результат не означает принятия V7-4 runtime; проверочные ограничения указаны в `docs/HANDOFF_2026-11-16.md`. Не делать push в default branch.
