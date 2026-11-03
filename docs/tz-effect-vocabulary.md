# ТЗ: словарь эффектов карт (черновик на согласование)

Дата: 03.11.2026. Автор: Единорог Аналитик. Статус: ЧЕРНОВИК, задачи Бэкенду не выданы до согласования состава Даниилом.
Источник фактов: server/data/catalog.v2.json (329 карт, 161 карта с effects), executor.ts, leader.ts, gameService.ts (замер 03.11.2026).

## 0. Принцип

Карта — чистые данные. Движок не содержит ни одного сравнения по имени или id карты. Всё поведение карты описывается через:
**триггер** (когда) → **действие kind** (что) → **параметры** (сколько, кому, на что, при каком условии).
Новая карта с уже существующей комбинацией не требует правки кода. Админка собирает карты только из этого словаря.

## 1. Единорог и маска (общее для всех действий)

**Классификатор «единорог»** — одна функция, четыре типа:
- `ultimate_unicorn` — Высший единорог
- `basic_unicorn` — Обычный единорог
- `magical_unicorn` — Магический единорог
- `baby_unicorn` — Малыш единорог

Тип `unicorn` (сейчас в коде) в каталоге не существует — удаляется. Сейчас логика продублирована в трёх местах: `engine/leader.ts`, `engine/executor.ts` (isUnicornCategory), `gameService.ts` (matchesCardGroup). Должна остаться одна.

**Малыш** имеет признак `source_zone: nursery_only`: фильтры `search`/`move`/`pull`/`steal` из колоды и сброса его исключают, из Яслей — разрешают.

**Маска (аура)** — параметр `mask` на карте-штрафе: `panda` | `cat` | `otter` | `poop`.
Пока штраф с `mask` лежит в конюшне игрока:
- его единороги считаются маской (панды/коты/выдры/какашки), счёт при победе по ним **0** (leader не считает);
- `sacrifice`, `steal`, `destroy`, `move`, `swap` **не могут выбрать** такого единорога целью — одна точка проверки `isTargetableFor`;
- свойства самих замаскированных карт (их enter-эффекты, их собственные действия) **работают как раньше**;
- маска снимается, когда штраф уходит из конюшни.

Карты: Пандамониум (`mask: panda`), Котострофа (`cat`), Выдропокалипсис (`otter`), какашки (`poop`). Сейчас это `set_flag` в мёртвый `state.flags` — дефект, см. §5.

## 2. Триггеры (когда срабатывает эффект) — 19

Сейчас executor читает 4 (immediate, on_play, on_turn_start, when_destroyed). Остальные 15 — мёртвые.

| Триггер | Карт в v2 | Стадия | Что нужно движку |
|---|---|---|---|
| `on_play` | 30 | розыгрыш магии/мгновенной в свою очередь | читается |
| `on_turn_start` | 35 | начало хода | читается |
| `on_turn_end` | 2 | конец хода | **добавить** |
| `on_enter_stable` | 60 | попадание единорога/штрафа в конюшню | **добавить** (сейчас хардкод по имени в 11 хуках) |
| `on_leave_stable` | 1 | уход из конюшни | **добавить** |
| `while_in_stable` | 24 | аура, пока карта в конюшне | **добавить** (маски, модификаторы руки, запреты) |
| `when_destroyed` | 11 | после уничтожения карты | читается |
| `on_would_be_destroyed` | 4 | замена уничтожения (до) | **добавить** |
| `on_would_be_destroyed_or_sacrificed` | 1 | замена уничтожения/жертвы | **добавить** |
| `on_any_unicorn_sacrificed_or_destroyed` | 1 | любой единорог в игре жертвован/уничтожен | **добавить** |
| `on_opponent_play` | 4 | соперник разыгрывает карту | **добавить** (окно реакции) |
| `on_opponent_plays_neigh` | 1 | соперник разыгрывает Ржание | **добавить** |
| `on_opponent_plays_spell` | 1 | соперник разыгрывает магию | **добавить** |
| `on_opponent_plays_unicorn` | 2 | соперник разыгрывает единорога | **добавить** |
| `on_opponent_plays_upgrade_downgrade` | 1 | соперник разыгрывает усиление/ослабление | **добавить** |
| `on_opponent_pull_baby` | 1 | соперник достаёт Малыша из Яслей | **добавить** |
| `on_opponent_sacrifices` | 1 | соперник жертвует | **добавить** |
| `on_opponent_unicorn_effect` | 1 | соперник применяет эффект единорога | **добавить** |
| `on_opponent_would_draw` | 1 | соперник должен добрать | **добавить** |

Чтение `on_opponent_*` и `on_would_be_destroyed*` — это окна реакции, они связаны с логикой Neigh (gameService), проектируются вместе с Бэкендом.

## 3. Виды действий (kind) — 42

Сейчас в executor 31 `case` (часть — не виды действий, а типы селекторов: `opponent`, `self`, `unicorn`, `upgrade` и т.п.). Из 42 видов каталога у **24 нет исполнителя**.

Группы (что делает вид):

**Перемещение карт**
- `move` (16 карт), `return` (9), `return_to_hand` (6), `give` (3), `add` (3), `transfer` (0 в v2, в коде есть), `swap` (1), `steal` (17), `sacrifice` (34), `destroy` (14), `pull` (6), `discard` (30), `force_discard` (6)

**Добор и поиск**
- `draw` (21), `draw_conditional` (1), `draw_until_limit` (1), `search` (19), `reveal` (3), `peek` (1), `scry` (2), `mill_until` (1), `reorder_top` (2), `shuffle_deck` (15), `mega_shuffle` (1)

**Ход и ограничения**
- `extra_action` (1), `limit_actions` (3), `skip_phase` (6), `skip_turn` (1), `goto_end_turn` (в коде), `restrict_action` (2), `modify_action` (3), `modify_hand_limit` (1), `modify_win_condition` (1), `pass_hands` (1)

**Реакции и отмены**
- `cancel` (9), `prevent` (8), `redirect_target` (1), `force_play` (2), `reactive_trigger` (10), `copy_effects` (1), `choice` (5), `choose_card_type` (1), `conditional_loop` (1), `set_flag` (4)

Виды без исполнителя сейчас (24): choice, pull, force_discard, return_to_hand, prevent, draw, reactive_trigger, mega_shuffle, copy_effects, cancel, scry, modify_action, peek, conditional_loop, pass_hands, mill_until, draw_conditional, skip_turn, draw_until_limit, redirect_target, restrict_action, force_play, choose_card_type, modify_hand_limit.

## 4. Параметры — что выбирается в админке

Общие для любого действия:

| Параметр | Значения | Пример |
|---|---|---|
| `kind` | один из 42 | `force_discard` |
| `quantity.value` | число | 2 |
| `quantity.mode` | `exact` (ровно), `up_to` (до), `all` (все), `random` (случайная) | up_to 2 |
| `quantity.is_player_choice` | true/false (выбирает игрок) | true |
| `target_player` | `self`, `opponent`, `chosen`, `all`, `other_each` | chosen |
| `target.scope` | `self`, `opponent`, `any`, `any_player`, `global` | any |
| `target.zone` | `stable`, `hand`, `deck`, `discard`, `nursery`, `top_of_deck` | hand |
| `target.filters.card_group` | `unicorn`, `magic`, `upgrade`, `downgrade`, `instant`, `any` | unicorn |
| `target.filters.unicorn_type` | `ultimate`, `basic`, `magical`, `baby` | ultimate |
| `target.filters.exclude_tags` | список | stolen_this_turn |
| `optional` | true/false (кнопка «Использовать» / «должны использовать») | true |
| `condition` | `has_card`, `hand_size`, `unicorn_count`, `negate` | has_card magic |
| `duration` | `this_turn`, `until_end_of_turn`, `while_in_stable` | this_turn |
| `destination` | `hand`, `deck_top`, `deck_bottom`, `discard`, `stable`, `nursery` | discard |
| `mask` (только для штрафов-масок) | `panda`, `cat`, `otter`, `poop` | panda |

Частные параметры (по видам):
- `force_discard` — `quantity` (1/2/3/N);
- `sacrifice` — `quantity` (N), цель-единорог с учётом маски и Малыша;
- `draw` — `quantity` (1/2/...), `optional`;
- `search`, `pull` — `source_zone` (для Малыша — только `nursery`);
- `prevent` — `prevented_action` (какой вид отменять);
- `cancel` — `cost` (что сбросить, сколько), `cancel_level` (вес: Neigh 1, Super Neigh 2);
- `skip_phase` — `phase` (`draw`, `play`, `end`);
- `redirect_target` — `new_target_player`;
- `reactive_trigger` — `on_event`, `actions`, `optional`.

## 5. Что сейчас сломано — и на что опираются решения

1. Маски: `set_flag` пишет в `state.flags`, у которого **ноль читателей**. `leader.ts` ждёт `transforms_unicorn` полем карты. Маска не работает вообще.
2. Малыш: доступен из колоды и сброса, признака нет.
3. Триггеры: 15 из 19 мёртвые — карты с ними (60 `on_enter_stable`, 24 `while_in_stable`) не работают.
4. Сравнения по имени: 33 подстроки в executor, 18 из них на картах, которых нет в v2. Потерь эффектов от этого нет, но есть ложные срабатывания (`includes('unicorn')` ловит 81 карту).
5. Количество: в v2 у `quantity` только `{value}`. Режимов «до N», «все», «выбирает игрок» нет. Значит «сбрось 2» и «сбрось до 2» в данных сейчас не различаются — это надо добавить.
6. Две формы селектора (`target` и `targets`) — к одной.

## 6. Что согласовать с тобой до раздачи задач

1. Состав параметров (§4): ничего лишнего, ничего не пропущено? Особенно `quantity.mode` и `condition`.
2. Маска: `mask` на штрафе + аура «пока в конюшне» — верно ли понял (счёт 0, цель запрещена, свойства карты работают)?
3. Малыш: достаётся только из Яслей — включая `steal`, `pull`, `search`?
4. Выбор `choice` (Espresso Oracle): игрок выбирает вариант, а не код по условию — подтверждаешь?
5. Порядок волн: сначала словарь в схеме и триггеры, потом 24 недостающих вида, потом снятие имён, потом админка.

Пока ответов нет, задачи Бэкенду и Тестировщику не выдаю.
