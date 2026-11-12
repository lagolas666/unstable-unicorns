# Ясли: флаг `source_zone` вместо `type: baby_unicorn`

Дата: 05.11.2026. Решение Аналитика. Закрывает блокер шага 2 плана по Малышам.

## Проблема

План шага 2 предполагал «назначение nursery по типу `baby_unicorn` через готовый `isNurseryOnly`».
Проверка каталога показала: **тип `baby_unicorn` непригоден как признак Малыша.**

Доказательства из `server/data/catalog.v2.json` (329 карт):

| Проверка | Результат |
|---|---|
| карт с `type: "baby_unicorn"` | 95 |
| из них непустые `effects` | 0 |
| из них с `md_num` | 0 |
| из них с `name_en` | 0 |
| из них присутствуют в чистом `UNICORNS.md` (161 карта) | **0** |
| карт-действий под этим типом | 42 |

Все 95 сидят в грязной wiki-части каталога (168 карт вне UNICORNS.md). В чистых данных
`baby_unicorn` встречается **только как `subtype` в фильтрах** (10 вхождений, например
`"filters": { "subtype": "baby_unicorn" }` в pull из Яслей) — сами карты Малышей туда не входят.

Под одним ярлыком лежат: настоящие Малыши (`baby_bearicorn`), плейсхолдеры wiki (`baby_archangel_unicorn`,
текст `C&C Print`), карты-действия (`grow_up` — SACRIFICE Baby Unicorn, `a_cute_attack`, `unicorn_shrinkray`)
и вообще не карты (`alphalist` — список игроков, `simple_gameplay`).

Ставить `nursery_only` по этому типу = отправить в Ясли 42 карты-действия при уничтожении/жертвоприношении.
Живой дефект подтверждён ранее: `unicorn_shrinkray` с `type: baby_unicorn` уничтожает единорогов.

## Решение

Признак Малыша — **явный флаг данных `source_zone: "nursery_only"`**, а не `type` и не сравнение по имени.
Флаг уже проставлен: 53 карты, `docs/nursery-only-patch.json`.

### Основание для флага — два класса

**Класс A (42 карты) — по тексту правила.** В описании карты дословно правило Малыша:
«если эту карту пожертвуют / уничтожат / вернут в руку — верните её в Ясли». Формулировка взята
из текста самой карты, а не из имени. Контроль: у карт других типов правило не встречается ни разу (0).

**Класс B (11 карт) — по имени при плейсхолдере wiki.** Текст `C&C Print` (обрубок), но имя — малыш:
`angelic_baby_unicorn`, `baby_archangel_unicorn`, `baby_bearicorn`, `baby_belugacorn`,
`baby_nightmare_unicorn`, `baby_pegasuscorn`, `baby_penguincorn`, `baby_slothicorn`,
`demonic_baby_unicorn`, `dingocorn`, `million_dollar_baby_unicorn`.

Контроль A∪B: карт-действий в флаге 0, карт не `type: baby_unicorn` в флаге 0,
карт с текстом правила без флага 0.

### Класс C (42 карты) — отложен, флаг не ставится

Карты, где `baby_unicorn` — это тип материала, а не карта-Малыш: `grow_up`, `a_cute_attack`,
`unicorn_shrinkray`, `baby_trap`, `the_great_baby_heist`, `shotgun_baby_unicorn`, `tasty_baby_unicorn`,
`cannibal_baby_unicorn`, `dumpster_baby_unicorn`, `upside_down_baby_unicorn` и т. д.
Их надо разбирать отдельно: часть из них — настоящие единороги с искажённым текстом,
часть — магические карты, часть — вообще не карты.

## Что сделано в каталоге

- `server/data/catalog.v2.json`: 53 карты получили `"source_zone": "nursery_only"` сразу после `id`.
- Формат сохранён: отступ 2, LF, 8287 → 8340 строк, +1749 байт (ровно 53 × 33), 329 карт, JSON парсится.
- Бэкап: `catalog.v2.json.prev_nurseryflag` (224286 байт, sha исходника).
- Кодировка: U+FFFD 0, пар Р/С+Latin1 0, BOM нет.
- Генератора каталога нет — файл первичный, флаг не затрётся регенерацией.
- Код флаг не читает: изменение пассивное, поэтому гейт зелёный.

## Гейт после правки

jest EXIT=0, 38/38 сьютов, 427 passed / 3 skipped / 430; tsc EXIT=0, ошибок 0. Совпадает с baseline.

## Следствие для шага 2

`isNurseryOnly` и точки destroy/sacrifice/return_to_hand должны смотреть на
`card.source_zone === 'nursery_only'`. `type: 'baby_unicorn'` в движке не использовать нигде.

## Остаток для Даниила

Класс C (42 карты) требует классификации: настоящий ли это единорог, магическая карта или мусор wiki.
Отдельно висит `nightmare_pact` (дубль смысла `md158` «Кошмарный пакт») — вопрос от 05.11.2026 не закрыт.
