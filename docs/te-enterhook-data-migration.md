# Шаг 2 п.21: фикстуры входа в стойло переведены на данные

Дата: 04.11.2026. Исполнитель: Единорог Тестировщик. Задача Аналитика.

## Что сделано

`server/test/enterHook.test.ts` переписан: эффекты входа берутся из `server/data/catalog.v2.json`
(`effects` с `trigger: 'on_enter_stable'`), а не из английских имён карт.

- **9 вызовов `fromCatalog(...)`** — карта копируется из каталога целиком (id/name/type/effects).
- Имена в каталоге **русские** («Хронорог», «Франкенрог», «Единорог-кукловод»), поэтому
  успех DATA-кейсов возможен только если эффект пришёл из данных, а не из хардкод-блока.
- В каждом DATA-кейсе стоит страховка `expect(name).not.toContain('<хардкод-токен>')`.

## Группы кейсов (14 тестов, 4 describe)

| Группа | Кол-во | Смысл |
|---|---|---|
| DATA | 5 | D1 Chronocorn, D2 Frankenunicorn, D3 Puppeteer, D4/D4b Nightmare, D5 инвариант каталога |
| DOUBLE (страж) | 3 | G1 Chronocorn с именем «Chronocorn», G2 с именем «Frankencorn», G3 контроль без данных и без имени |
| HARDCODE-ONLY | 3 | H1 Zombie Knight, H2 Puppetmaster, H0 инвариант «этих карт нет в v2» |
| Окно реакций | 2 | R1 вход из данных при `skipGenericLoop`, R2 двойной `on_play` |

**Страж двойного исполнения (G1/G2)**: карта берётся из каталога (данные есть), но `name`
намеренно выставляется английским так, чтобы совпасть с хардкод-блоком. Если `hasDataEnter`
перестанет глушить хардкод, эффект сработает дважды и тест покраснеет.

## Список карт, остающихся на хардкоде (обоснование)

Проверено по каталогу v2 (`contains` по `name_en`/`name`, 329 карт):

| Хардкод-токен в executor.ts | Вхождений в v2 | Статус |
|---|---|---|
| `zombie knight` | 0 | карты нет — только хардкод |
| `puppetmaster` | 0 | карты нет (есть `puppeteer_unicorn_ultimate` md152 — это ДРУГАЯ карта, discard 1 себе) |
| `frankencorn` | 0 | карты нет (есть `frankenunicorn_ultimate` md150 — другая карта, данные работают) |
| `sentinel` | 0 | карты нет |
| `portal master` | 0 | карты нет |
| `ancestor` | 0 | карты нет |
| `chimeracorn` | 0 | карты нет |
| `epic level unicorn` | 0 | карты нет |
| `academicorn` | 0 | карты нет |
| `americorn` | 1, но `Gamericorn` (подстрока) | ложное совпадение; сама карта — `Ameri'corn` md15 с апострофом, токен её НЕ ловит |
| `nightmare` + `unicorn` | есть `nightmare_unicorn_ultimate` md151 с данными | хардкод гасится данными, но нужен ещё `exclude_self` (см. дефект) |

Итог: **10 хардкод-токенов мертвы на v2** (карт нет), и 1 (`americorn`) ловит чужую карту по подстроке.
Сносить эти блоки можно без потери покрытия — но только вместе с удалением H1/H2, иначе они покраснеют.

## Найденный дефект (доложен Аналитику)

**BUG-NM-EXSELF: `filters.exclude_self` не реализован в движке.**

- В `server/src/**` — **0 вхождений** `exclude_self`/`excludeSelf`.
- В каталоге v2 флаг стоит у **13 карт**: `sadistic_ritual_downgrade`, `archangel_unicorn_ultimate`,
  `nine_tailed_foxicorn_ultimate`, `artful_unicorn_ultimate`, `time_traveler_unicorn_ultimate`,
  `nuclear_scientist_unicorn_ultimate`, `progenitor_unicorn_ultimate`, `anti_magic_bubble_downgrade`,
  `no_grazing_downgrade`, `level_90_unicorn_ultimate`, `nightmare_unicorn_ultimate`,
  `shadow_unicorn_ultimate`, `reaper_unicorn_ultimate`.
- Проявление: `nightmare_unicorn_ultimate` (sacrifice 3, `exclude_self: true`) при входе в пустое
  стойло жертвует **саму себя** — уходит в `discard` вместо `stable`.
- Кейс D4 фиксирует фактическое поведение и подписан как дефект; после фикса Бэкенда ожидания
  переворачиваются на `stable` содержит карту и пустой `discard`.

## Доказательства

**Полный гейт после правок** (`node node_modules/jest/bin/jest.js --runInBand --ci --silent`):

```
exit=0  suites=37/37  tests=425  passed=422  failed=0  skipped=3
```

Baseline до правок был 37 сьютов / 418 total / 415 passed / 3 skipped — прибавка ровно **+7 тестов**.

**Мутация невакуумности** (`_te_mut_hasdataenter.js`): `hasDataEnter ? '' : ...` → `false ? '' : ...`
в `executor.ts` L401.

```
M1 anchor hits=1
M1 exit=1  failed=2
   RED G1 Chronocorn с английским именем: discard 1 ровно один раз
   RED G2 Frankenunicorn с именем "Frankencorn": discard 1 ровно один раз
   GREEN остальные 12
M1 откат: sha совпадает с исходным: true
```

**Файл**: `server/test/enterHook.test.ts` — 19247 б / 370 строк, CRLF=0 loneLF=369 U+FFFD=0,
sha256 `56683787653673ad7c76fe50c706fa121be67b921c95a2dd3d99eaa4c9d88171`.
Бэкап: `test/enterHook.test.ts.prev_hooks` (исходный 9222 б, sha `f06081da…`).

**TSC**: `npx tsc --noEmit` exit=0.

## Что не проверено

- `server/src/**` не тронут — правки движка (снос хардкода, `exclude_self`) вне моей зоны.
- Живой сокет/UI для входа в стойло не гонял: проверка идёт через `playCard`/`resolvePendingNow`
  напрямую (тот же сервисный путь, что REST `/play` и socket `play_card`).
