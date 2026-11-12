# MEMORY.md — Краткосрочная память проекта

> Читать **перед началом** любой сессии.
> Обновлять: когда задачи завершены, баги найдены, архитектурные решения приняты.

---

## Текущий статус (12.11.2026)

**Фаза:** V7-2 — while_in_stable: реализация 5 kind (prevent, reactive_trigger, modify_hand_limit, restrict_action, modify_action) в executeAction Бэкендом.
**Гейт:** tsc EXIT=0, 59 suites, 533 passed, 4 skipped, 0 fail. Jest EXIT=0.

- Покрытие эффектов: 43 kind (22 живых, 21 НИКТО), 19 triggers (7 живых, 13 НИКТО).
- while_in_stable: диспетчер жив (executor.ts второй проход), но 5 kind падают в default → false.
- Приоритет 4 (name-сравнения) — закрыт.
- Анализ покрытия while_in_stable — завершён, effect-coverage.md обновлён.

---

## Последние архитектурные решения

| Дата | Решение |
|------|---------|
| 12.11.2026 | while_in_stable — диспетчер существует, но kind prevent/reactive_trigger/modify_hand_limit/restrict_action/modify_action не имеют case в executeAction → default false. set_flag и modify_win_condition работают. |
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