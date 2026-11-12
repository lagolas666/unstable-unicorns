# QA-отчёт: покрытие `filters.subtype`

Дата: 07.11.2026
Автор: Единорог Тестировщик
Задача: @Единорог Аналитик — сьют на `filters.subtype` с обязательным мутационным критерием.

## Итог

Покрытие создано, критерий приёмки выполнен: решающая мутация `cardSubtypeTags → []`
краснит 4 кейса из 5, при чистом файле сьют зелёный, полный гейт не хуже baseline.

Файл: `server/test/subtypeFilters.test.ts` — 9939 байт, CRLF 177 строк, loneLF=0, U+FFFD=0,
sha256 `7ef27eb9…`. Правок в `server/src/**` нет: `src/engine/unicornTypes.ts` вернулся
побайтово, sha `d8c6ccd2…` до и после всех мутаций.

## Почему это путь, а не юнит-тест хелпера

Кейсы идут через реальную цепочку исполнения действия:

```
resolveActions (executor.ts L621)
  → isActionPossible (L431)
    → countAvailableTargets (L509, matchesFilter)
      → matchesFilter (L241), ветка subtype на L246
        → cardSubtypeTags (unicornTypes.ts L143)
```

Юнит-тест на `cardSubtypeTags` закрыл бы дыру иначе: мутация внутри хелпера видна, а вот
сломанное соединение фильтра с хелпером или неисполнение действия — нет. Здесь красный
означает «действие отработало неверно», а не «функция вернула не то».

## Кейсы

Фикстуры — данные `server/data/catalog.v2.json`, сравнений по имени карты нет.

| # | Кейс | Что проверяет | Мутации, которые краснят |
|---|---|---|---|
| S1 | `basic` | `apprentice_unicorn` (`type: basic_unicorn`, поля `subtype` в данных НЕТ) выбирается целью `filters:{card_group:'unicorn', subtype:'basic'}` и уходит в сброс; `magical_unicorn` и `ultimate_unicorn` из того же стойла не тронуты | M3, M4 |
| S2 | `baby_unicorn` | `angelic_baby_unicorn` (`source_zone: nursery_only`) выбирается целью, но при уходе из стойла попадает в **Ясли** (`state.nursery`), сброс пуст. Ловушка: `a_cute_attack` (`type: baby_unicorn`, `source_zone` нет) целью **не** становится и остаётся в стойле | M2, M4 |
| S3 | `magic` | `rhinocorn_magic` (`subtype: ['magic']`, массив) выбирается; Заклинание `lucky_streak_spell` (`type: 'magic'`, поля `subtype` нет) — нет | M4 (M1 эквивалентна, см. ниже) |
| S4 | `ultimate` | `elusive_ocelotcorn_ultimate` (`subtype: ['ultimate']`) выбирается, Обычный остаётся | M4 |
| S5 | контроль | Без `subtype` то же действие исполняется и берёт верх стойла — доказательство невакуумности S1–S4 | нет (страж) |

Страховки внутри фикстур (проверки данных до действия): у `apprentice_unicorn` `subtype`
обязан отсутствовать, у Магического и Высшего — быть массивом, у `a_cute_attack` —
`source_zone` отсутствовать. Если каталог поменяют, сьют упадёт на страховке, а не покажет
ложную зелень.

## Мутации

Все правки — только `server/src/engine/unicornTypes.ts`, анкер с `\r\n`, `hits=1` в каждом случае.

| ID | Мутация | `tsc` | Jest | Красные кейсы | Вердикт |
|---|---|---|---|---|---|
| M4 | в начало `cardSubtypeTags`: `if (String((card as any)?.id \|\| '').length > 0) return [];` | 0 | exit 1 | **S1, S2, S3, S4** | KILLED |
| M2 | `if (type === 'baby_unicorn') return ['baby_unicorn'];` (снят `isNurseryOnly`) | 0 | exit 1 | **S2** | KILLED |
| M3 | снесена ветка `basic_unicorn` | 0 | exit 1 | **S1** | KILLED |
| M1 | `Array.isArray(raw) ? []` — снята нормализация массива `subtype` | 0 | exit 0 | нет | **EQUIVALENT** |

M1 эквивалентна: у Магического и Высшего при пустом списке исполнение уходит в фоллбэк по
`type` (`magical_unicorn → ['magic']`, `ultimate_unicorn → ['ultimate']`) и выдаёт тот же тег.
Мутация не ослабляет поведение, поэтому не зачитывается как критерий — но и не является
дырой в покрытии.

### Красный под M4 (текстом)

```
filters.subtype доходит до cardSubtypeTags через путь действия › S1 basic: цель — Обычный единорог, у которого поля subtype в данных НЕТ
filters.subtype доходит до cardSubtypeTags через путь действия › S2 baby_unicorn: берётся настоящий Малыш (source_zone nursery_only) и уходит в Ясли, а не в сброс
filters.subtype доходит до cardSubtypeTags через путь действия › S3 magic: берётся Магический единорог (subtype массивом), а Заклинание с type magic — нет
filters.subtype доходит до cardSubtypeTags через путь действия › S4 ultimate: берётся Высший единорог по тегу из массива subtype

expect(received).toBe(expected) // Object.is equality
Expected: true
Received: false
```

M2 и M3 краснят по одному своему кейсу (`S2`, `S1`) — точечно, без побочных падений.

### Откат

```
M4 anchorHits=1 origSha=d8c6ccd2 mutSha=627b8856 backSha=d8c6ccd2 BYTE_IDENTICAL=true
M1 anchorHits=1 origSha=d8c6ccd2 mutSha=7ca63a37 backSha=d8c6ccd2 BYTE_IDENTICAL=true
M2 anchorHits=1 origSha=d8c6ccd2 mutSha=9827985c backSha=d8c6ccd2 BYTE_IDENTICAL=true
M3 anchorHits=1 origSha=d8c6ccd2 mutSha=c754061a backSha=d8c6ccd2 BYTE_IDENTICAL=true
```

Итоговый `src/engine/unicornTypes.ts`: 9627 байт, CRLF 156 строк, loneLF=0, U+FFFD=0,
sha256 `d8c6ccd20e3498c2a5c9e24da036a54a19a6979da0370941774e4d7dd9f88ad6`.
Башни мутанта в рабочем дереве нет.

## Гейт

```
Test Suites: 50 passed, 50 total
Tests:       3 skipped, 477 passed, 480 total
JEST_EXIT=0  TSC_EXIT=0
```

Baseline был `49 / 475 / 472 passed / 3 skipped`. Стало `50 / 480 / 477 passed / 3 skipped`.

Расхождение с ожиданием Аналитика (`50 / 479 / 476 / 3`) — ровно на один тест: кейсов во
файле 5, а не 4, потому что добавлен контрольный S5 без `subtype`. Он нужен как страж
невакуумности: без него красный на S1–S4 можно было бы списать на сломанный `sacrifice`, а не
на фильтр. Сумма новых зелёных: +5 к прогону, из них 4 убивают мутанта M4.

## Замечания вне задачи

- `destroy` (executor.ts L1601) читает только `card_group` — `exclude_self` и `subtype` там
  игнорируются. Сегодня ни одна карта каталога не сочетает `destroy` с этими флагами
  (`filters.subtype` встречается только в `sacrifice`-подобных и `search`-действиях), поэтому
  дефектом не считаю. Заметка Аналитика подтверждена.
- Три `magic`-фильтра (Ленивцерог, Нимфорог, Чёрная дыра) адресуют Магических единорогов, а не
  Заклинания — проверено данными в S3.
- Временные скрипты прогона лежат в `server/`: `_te_read_subtype.js`, `_te_scan_subtype.js`,
  `_te_cards_subtype.js`, `_te_pick_cards.js`, `_te_norm_subtype_test.js`, `_te_gate_subtype.js`,
  `_te_mut_subtype.js`, `_te_mut_subtype2.js`, `_te_mut_subtype.json`,
  `_te_mut_subtype_report.txt`. Удаляю только по разрешению Аналитика.
