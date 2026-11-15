# QA-аудит: V7-4 — `dispatchTrigger(on_opponent_*)`

**Дата актуализации:** 13.11.2026  
**Автор:** Единорог Тестировщик  
**Статус:** **BLOCKED —** свежий полный набор тестов зелёный, но в игровом пути остаётся определение Oceloticorn по имени; API-контракт не документирует optional `trigger_effect`/`confirm`. Полный V7-4 не закрывать до решения по этим остаткам.  
**Основные тесты:** `server/test/onOpponentTriggers.test.ts` (14 тестов) и `server/test/v74FollowupTriggers.test.ts` (11 тестов по актуальной записи MEMORY).  
**Область изменений этой актуализации:** только этот отчёт; `server/src/**` и тесты не менялись.

## Проверка текущего состояния

Проверено по текущему дереву: `server/src/routes/game.ts`, `server/src/gameService.ts`, `server/src/engine/executor.ts`, `server/src/data/canReactFlags.ts`, `server/src/data/catalog.ts`, оба V7-4 test-файла, `docs/API_CONTRACT.md`, `docs/GAME_RULES.md`, `docs/MEMORY.md` и `docs/PROJECT_MAP.md`.

### Event dispatch и regressions

`onOpponentTriggers.test.ts` сохраняет 14 базовых сценариев: optional confirm/skip и владелец окна, типовая классификация событий, собственный актор, `while_source_in` и последовательные окна для нескольких оппонентов. Полный свежий Jest прогон подтвердил оба набора (`PASS test/onOpponentTriggers.test.ts`, `PASS test/v74FollowupTriggers.test.ts`).

Свежий follow-up тестовый файл закрывает прежние заявления об отсутствии источников для четырёх событий:

- `on_opponent_would_draw`: официальный добор приостанавливается до ответа; обычная Neigh не отменяет окно; тест проверяет и прямой `cancel` по текущему узкому контракту.
- `on_opponent_pull_baby`: срабатывание при вытягивании малыша из Яслей и отсутствие срабатывания при краже карты из руки.
- `on_opponent_sacrifices`: проверены успешная жертва эффектом и стоимостью, а также отсутствие dispatch при неуспешной/нулевой жертве.
- `on_opponent_unicorn_effect`: успешный эффект карты-единорога вызывает реакцию; отменённый/неуспешный розыгрыш не вызывает её.
- `on_opponent_plays_neigh`: подтверждённая Neigh-реакция из `/react/neigh` оплачивается (карта уходит из руки в сброс) и ставит реакцию в очередь.

**Вывод:** прежние findings «четыре события вообще не диспатчатся» и «принятая Neigh не диспатчит `on_opponent_plays_neigh`» устарели и закрыты актуальным follow-up. Это не подтверждает полное покрытие всех возможных event sources/комбинаций.

### Optional-окна и порядок

Текущие тесты подтверждают optional-окно без преждевременного эффекта, выполнение только после подтверждения владельцем, отказ на confirm без владельца/от другого игрока, skip без исполнения и очередь последовательных реакций. Безопасное optional-действие (draw) также открывает окно; безопасный non-optional эффект разрешается без него. `resolvePending` обрабатывает optional `trigger_effect` с явным `confirm: true` и идентификатором владельца.

### Оставшиеся findings

1. **BLOCKER / нарушение правила отсутствия сравнений по имени карты:** `server/src/routes/game.ts`, helper `findNeighBlockOwner` уже опирается на `blocks_neigh_for_others` в данных, однако в ветке `POST /playWithWindow` признак неотменяемости отдельно вычисляется через `nameLower === 'elusive oceloticorn' || nameLower.includes('oceloticorn')`. Там же учтён data-флаг `cannot_be_neighed`. В `server/src/data/canReactFlags.ts` нет записи Oceloticorn. Значит этот путь зависит от имени и не полностью data-driven (нарушает global #20). Исходники вне зоны Тестировщика; передать Бэкенду/Аналитику на решение, не менять здесь.
2. **BLOCKER / неполный контракт:** `docs/API_CONTRACT.md` §1.5 описывает у `/resolvePending` `cardId`, `skip`, `byPlayerId`, но не описывает `confirm`, `PendingAction.kind: 'trigger_effect'`, поля optional reaction и правило «только явное подтверждение владельца». Фактическое поведение покрыто тестами и кодом, но контрактная документация отстаёт. Требуется решение, кто актуализирует контракт, либо явное подтверждение, что это вне scope V7-4.
3. **FOLLOW-UP, не V7-4 blocker:** свежий `npm test -- --runInBand --detectOpenHandles` завершился exit 0, но Jest обнаружил один открытый `Timeout`: `schedulePendingResolution` в `server/src/gameService.ts`, вызванный `openHandLimitWindow` → `endTurn` в `server/test/playContract.test.ts:273`. Это hand-limit cleanup, не сценарий on-opponent; проверить/устранить отдельной задачей.
4. **Пределы охвата:** нет полного перебора каталога и всех комбинаций для downgrade, мгновенных карт/Neigh subtype, таймаута очередного окна и взаимодействия с `await_choice`. Мутационный прогон в рамках этого аудита не выполнялся. Это пробелы охвата, не доказанные текущие ошибки поведения.

## Свежие гейты и доказательства

Команды запускались из `server/`:

| Команда | Результат |
|---|---|
| `npm test -- --runInBand --detectOpenHandles` | **EXIT 0**; 65 suites passed, 566 tests passed, 4 skipped (570 total). `detectOpenHandles` сообщает один Timeout; стек приведён выше. |
| `npm test -- --runInBand` | **EXIT 0**; 65 suites passed, 566 tests passed, 4 skipped (570 total). После завершения Jest предупреждает, что процесс не завершился через 1 секунду из-за async-операции; это согласуется с открытым Timeout. |
| `npx tsc --noEmit` | **EXIT 0**, вывода ошибок нет. |

Гейты зелёные, но предупреждение об открытом handle остаётся фактическим долгом очистки; не трактовать exit 0 как его устранение.

## Итог

**BLOCKED, не DONE.** Четыре прежних «нет источника» и событие принятой Neigh подтверждены follow-up тестами; полный свежий Jest и TypeScript проходят. Остаются name-based fallback Oceloticorn и недокументированная часть REST-контракта optional trigger reaction. Отдельно зарегистрирован открытый hand-limit timeout, не относящийся к V7-4. После решения Аналитика/Бэкенда по двум blocker’ам и передачи timeout в отдельный follow-up аудит V7-4 можно пересмотреть. Тестировщик не изменял `server/src/**`.
