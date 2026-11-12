# Приёмка: filters.subtype (патч Бэкенда)

Дата: 06.11.2026. Приёмку проводил Аналитик своими руками.

## 1. Код — принят

`server/src/engine/unicornTypes.ts` (9627 б, 156 строк, CRLF, loneLF=0, U+FFFD=0, bom=false)
`sha256=d8c6ccd20e3498c2…` — совпал с заявленным Бэкендом.

`server/src/engine/executor.ts` (102572 б, 1853 строки, CRLF, loneLF=0, U+FFFD=0, bom=false)
`sha256=3d50514aed27de27…` — совпал.

Новый хелпер `cardSubtypeTags` L136–155: берёт `card.subtype` (массив или строка), при
отсутствии поля выводит тег из `type`. Ловушка с Малышом закрыта — `baby_unicorn` только
при `source_zone === 'nursery_only'`. Сравнений по имени карты внутри нет: правило
«условия карт — данные» соблюдено.

`matchesFilter` L246: прямое сравнение `card.subtype !== filter.subtype` заменено на
`!cardSubtypeTags(card).includes(String(filter.subtype))`. Других прямых сравнений по
`subtype` в `executor.ts` не осталось (проверено поиском — 0 вхождений).

Файлы отката на месте: `unicornTypes.ts.prev_subtype` (sha d405da24…), `executor.ts.prev_subtype` (sha e8f8a342…).

## 2. Данные — проверено, цифры Бэкенда поправлены

Фильтров `filters.subtype` в `catalog.v2.json` ровно **20**:

| значение | вхождений |
|---|---|
| `baby_unicorn` | 10 |
| `basic` | 7 |
| `magic` | 3 |

Бэкенд в отчёте указал 6/11 — расхождение в разбивке, общая сумма 20 верна. На приёмку не влияет.

Распределение по местам: `effects[0].actions[0].target` 10, `effects[0].actions[1].target` 6,
`play_requirements.conditions[0].target` 2, `condition.target` 1, `condition.rules[0].target` 1.

Поля `subtype` у карт: есть только у 86 карт — `["magic"]` у 70 Магических, `["ultimate"]` у 16 Высших.
У Обычных (73) и Малышей (95) поля нет — отсюда и был мёртвый фильтр.

Количество целей после патча (мой пробник на живом каталоге): basic 73, baby_unicorn 53,
magic 70, ultimate 16.

**Риск зацепить заклинания закрыт:** у 30 карт `type:'magic'` (Заклинания) поля `subtype`
нет, в `cardSubtypeTags` ветки для `type === 'magic'` нет → тег `magic` их не берёт. Три
фильтра `magic` (Ленивцерог, Нимфорог, Чёрная дыра) адресуют правильно — Магических единорогов.

## 3. Гейт — совпал с baseline

```
TSC  exit=0
JEST exit=0
Test Suites: 49 passed, 49 total
Tests:       3 skipped, 472 passed, 475 total
```
Сходится с baseline. Фиктивных `expect(true).toBe(true)` в `server/test/**` — 0.

## 4. Покрытие — ДЫРА, подтверждена моей мутацией

Четыре мутации, каждая в CRLF-нормализации, откат побайтово:

| мутация | пробник Аналитика | полный гейт |
|---|---|---|
| M1 вернуть прямое сравнение (executor L246) | failed=0 (не видит) | exit=0, 49 passed — **НЕ ЛОВИТ** |
| M2 убрать isNurseryOnly в ветке baby_unicorn | failed=2 | exit=0, 49 passed — **НЕ ЛОВИТ** |
| M3 убрать ветку basic_unicorn | failed=2 | exit=0, 49 passed — **НЕ ЛОВИТ** |
| M4 «теги не выдаются никогда» (`cardSubtypeTags` → `[]`) | — | exit=0, 49 passed — **НЕ ЛОВИТ** |

M4 — решающая: если бы хоть один тест гейта шёл через `filters.subtype`, он обязан был
покраснеть. Вывод: **`filters.subtype` не покрыт ни одним тестом гейта**, патч держится
только на моём пробнике вне `server/test/`. Заявление Бэкенда «гейт M1–M3 не ловит» подтверждено.

Все откаты `BYTE_IDENTICAL=true`, итоговые sha совпадают с исходными
(`ut=d8c6ccd20e3498c2`, `ex=3d50514aed27de27`).

## 5. Открытые хвосты

1. **Тестировщику** — сьют `server/test/subtypeFilters.test.ts` на 4 кейса: `basic` (раньше не
   матчился никогда), `baby_unicorn` (Малыш → Ясли, карта-действие не ловится), `magic` на
   массиве, `ultimate`. Сьют обязан краснеть на мутанте M4.
2. **`play_requirements.conditions` не исполняется** — подтверждаю, зона моя (`routes/game.ts`).
   Затронуты `rainbow_mane_upgrade` и `extra_tail_upgrade`. Отдельная задача.
3. **`destroy` (18 действий) читает только `card_group`** (executor L1601) — `exclude_self` и
   `subtype` в destroy игнорируются. Сегодня ни одна из 18 карт их не использует, но это
   кандидат в бэклог, не дефект.

## Итог

Код принят: дефект реальный, фикс минимальный и корректный, регрессий нет.
Непринятым остаётся покрытие — передаю Тестировщику с обязательным мутационным критерием.
