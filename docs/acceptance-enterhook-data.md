# Приёмка: перевод фикстур входа в стойло на данные каталога

**Дата:** 05.11.2026
**Принял:** @Единорог Аналитик
**Исполнитель:** @Единорог Тестировщик
**Файлы:** `server/test/enterHook.test.ts`, `server/test/awaitChoiceGuard.test.ts`, `server/test/defect07PendingOutcome.test.ts`
**Движок при приёмке не менялся:** `server/src/engine/executor.ts` sha256 `dc2c039b5fcc2d3d9a39db8174f8d30187959bba56370c57ab60f49aab68384e`, 114282 байта, CRLF 2073, loneLF 0.

## 1. Суть изменения

Эффект входа в стойло у тестовых карт `zk` (было `Zombie Knight`) и `pm` (было `Puppetmaster`) больше не приходит из хардкод-блоков `triggerEnterEffectsFor` по английскому имени, а лежит в `effects` карты с триггером `on_enter_stable`.

Имена заменены на нейтральные русские: `Некромант`, `Кукловод`. Хардкод-токенов `zombie` / `knight` / `puppet` / `master` в фикстурах нет — следовательно ветки по имени физически не могут сработать, и зелёный тест доказывает, что эффект пришёл из данных.

Механика движка, на которую опирается фикстура (проверено по коду):

| механизм | место | что делает |
|---|---|---|
| `normalizeActionTargets` | `executor.ts` L709, вызовы L665, L827, L856, L1065 | `target` → `targets`, поэтому фикстура пишется в схеме каталога |
| драйвер данных | `executor.ts` L592-597 | исполняет `on_enter_stable` ДО проверки `skipGenericLoop` |
| гашение хардкода | `executor.ts` L400-401 | `hasDataEnter` обнуляет `nameLower` |
| вторая ступень | `executor.ts` L830 | `requires_success_of_previous` = семантика `puppetDiscardOk` |

## 2. Состояние файлов

| файл | было, б | стало, б | sha256 (16) | EOL | U+FFFD |
|---|---|---|---|---|---|
| `enterHook.test.ts` | 19247 | 21818 | `8806c2d65d718943` | CRLF 430, loneLF 0 | 0 |
| `awaitChoiceGuard.test.ts` | 9280 | 9836 | `bfa3702e7e0ef325` | CRLF 240, loneLF 0 | 0 |
| `defect07PendingOutcome.test.ts` | 4253 | 4791 | `1fbb63ec05ded37f` | loneLF 120 (LF-файл как был) | 0 |

Бэкапы `.prev_datalift` на месте у всех трёх файлов. Символов U+0402–U+040F нет ни в одном.

## 3. Гейт (прогнан Аналитиком самостоятельно)

```
node node_modules/jest/bin/jest.js --runInBand --json --outputFile=_an_jest.json   (cwd = server)
JEST_EXIT=0
suites: 37 total, 37 passed, 0 failed
tests : 426 total, 423 passed, 0 failed, 3 skipped, 0 todo   success=true

node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
TSC_EXIT=0
```

Против baseline 425 тестов: **+1** — новый кейс `D6`. Скипов ровно 3, все три предсуществующие: `rewind … [superseded by rewind.test.ts]`, два Rainbow Lasso.

**Проверка отсутствия `.only`.** Статус `focused` в `--json` у `reactions.test.ts` и `rainbow_lasso.test.ts` — артефакт `jest.useFakeTimers`, а не `.only`. Регулярка `(describe|it|test).only` / `fdescribe|fit|ftest` по всем 40 файлам `server/test/*.ts` даёт `TOTAL_ONLY=0`. Молчаливого гашения тестов нет, счёт 426 включает все случаи.

## 4. Новый кейс D6 (закрывает дырку покрытия `optional`)

`enterHook.test.ts` L185-213: карта `Доброволец` с `on_enter_stable` + `optional: true`, рука `['op','a','b']`, после розыгрыша ожидание `['a','b']` и пустой сброс.

Причина появления: прежняя мутация Аналитика на `optional` была **эквивалентной** — 0 красных, покрытия не существовало.

## 5. Мутационная проверка Аналитика (свои мутации, не предъявленные агентом)

Мутации на `executor.ts` L594, откат побайтовый, `sha_before = sha_end`.

| # | мутация | hits | красных | сьюты |
|---|---|---|---|---|
| A | `optional !== true` → `optional === true` | 1 | 10 | `enterHook.test.ts`: D1, D2, D3, D4, **D6**, G1, G2, H1, H2, R1 |
| B | `trigger === 'on_enter_stable'` → `'__never__'` | 1 | 14 | `enterHook`: D1–D4, G1, G2, H1, H2, R1; `awaitChoiceGuard`: F1–F4; `defect07`: D1 |

Мутация A краснит именно `D6` — кейс невакуумный. Мутация B доказывает, что все девять кейсов группы H и все четыре стража окна F1–F4 действительно держатся на драйвере данных, а не на хардкоде.

## 6. Замечания приёмки

1. **Снос хардкода — не зона Тестировщика.** `server/src/**` принадлежит Бэкенду; задача передана Бэкенду, Тестировщику поставлен стоп на `executor.ts`.
2. **Тексты фикстур врут после миграции.** `describe('ХАРДКОД-ONLY: карты, отсутствующие в каталоге v2 …')` (L271), заголовки `H1 … только хардкод` (L275), `H2 … (хардкод)` (L303), комментарий L272-274 «эффект входа до сих пор приходит из хардкод-блоков». Эффект уже из данных. Косметика, но фикстура-документация обязана соответствовать поведению: следующий агент поверит комментарию и «починит» то, что уже работает. Поручено переименовать в DATA-группу.
3. Инвариант `H0` (L362-370) сохранён и проверяет, что карт `zombie knight`, `puppetmaster`, `frankencorn`, `sentinel`, `portal master`, `ancestor`, `chimeracorn`, `epic level unicorn` в каталоге v2 действительно нет.

## 7. Границы сноса хардкода (сверены Аналитиком построчно)

17 мёртвых блоков, 172 строки, `executor.ts`:

```
402-415  Americorn (PULL)              470-477  chronocorn (без комментария над блоком)
416-421  Angry Dragoncorn              478-489  Ancestor Unicorn
422-427  Alluring Narwhal              490-495  Chimeracorn
428-442  Academicorn                   496-524  Espresso Oracle Unicorn
443-451  Frankencorn                   525-533  Mystic Rainbow Unicorn
452-460  Elusive Oceloticorn           534-542  Game Master Unicorn
461-469  Epic Level Unicorn            549-554  Zombie Knight Unicorn
555-560  Sentinel Unicorn              561-572  Puppetmaster Unicorn
573-579  Portal Master Unicorn
```

Остаются два живых блока, разбираются отдельно по п.22:

- `543-548` Nightmare Unicorn — `sacrifice` 3 из своего стойла;
- `580-585` Archangel Unicorn — `sacrifice` 3 из своего стойла.

Порядок сноса: **снизу вверх**, иначе номера строк съезжают. После сноса `nameLower`/`hasDataEnter` (L400-401) обязаны остаться — на них висят эти два блока.
