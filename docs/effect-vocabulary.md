# Словарь эффектов Неудержимые Единороги

> **Источник:** executor.ts, catalog.v2.json (329 карт, 154 с эффектами)  
> **Статус:** 10.11.2026  
> **Принцип:** карты — чистые данные, ни одного сравнения по имени карты в движке.

---

## 1. Типы эффектов (ActionKind)

| kind | Count | Категория | Описание | Исполнитель |
|---|---|---|---|---|
| `destroy` | 14 | Уничтожение | Со стойла → в сброс | executor.ts L??? |
| `sacrifice` | 34 | Уничтожение | Своя карта со стойла → в сброс | executor.ts L??? |
| `discard` | 30 | Сброс | Из руки → в сброс | executor.ts L??? |
| `force_discard` | 6 | Сброс | Соперник сбрасывает из руки | executor.ts L??? |
| `draw` | 21 | Получение | Из колоды → в руку | executor.ts L??? |
| `draw_conditional` | 1 | Получение | Добирать при условии | executor.ts L??? |
| `draw_until_limit` | 1 | Получение | Добрать до лимита руки | executor.ts L??? |
| `search` | 19 | Получение | Выбрать карту из колоды в руку | executor.ts L??? |
| `reveal` | 3 | Получение | Показать верх колоды | executor.ts L??? |
| `peek` | 1 | Получение | Посмотреть карты колоды | executor.ts L??? |
| `steal` | 17 | Кража | Чужую карту → себе | executor.ts L??? |
| `move` | 16 | Перемещение | Из зоны → в зону | executor.ts L??? |
| `return` | 9 | Перемещение | Со стойла → в руку/колоду | executor.ts L??? |
| `return_to_hand` | 6 | Перемещение | Со стойла → в руку | executor.ts L??? |
| `give` | 3 | Перемещение | Свою → сопернику | executor.ts L??? |
| `pull` | 6 | Перемещение | Из Яслей → в стойло | executor.ts L??? |
| `swap` | 1 | Перемещение | Обмен картами | executor.ts L??? |
| `transfer` | — | Перемещение | Передача карты игроку | executor.ts L??? |
| `pass_hands` | 1 | Перемещение | Передача руки по кругу | executor.ts L??? |
| `add` | 3 | Создание | Выложить карту из ниоткуда | executor.ts L??? |
| `cancel` | 9 | Отмена | Отменить эффект | executor.ts L??? |
| `prevent` | 8 | Отмена | Предотвратить | executor.ts L??? |
| `redirect_target` | 1 | Отмена | Перенаправить цель | executor.ts L??? |
| `restrict_action` | 2 | Отмена | Запретить тип карт | executor.ts L??? |
| `skip_phase` | 6 | Фазы | Пропустить фазу хода | executor.ts L??? |
| `skip_turn` | 1 | Фазы | Пропустить ход | executor.ts L??? |
| `extra_action` | 1 | Фазы | Дополнительное действие | executor.ts L??? |
| `goto_end_turn` | — | Фазы | Немедленно завершить ход | executor.ts L??? |
| `limit_actions` | 3 | Ограничения | Лимит розыгрышей | executor.ts L??? |
| `reactive_trigger` | 10 | Особые | Ответная реакция | executor.ts L??? |
| `choice` | 5 | Особые | Выбор из вариантов | executor.ts L??? |
| `conditional_loop` | 1 | Особые | Цикл до условия | executor.ts L??? |
| `copy_effects` | 1 | Особые | Скопировать эффект | executor.ts L??? |
| `modify_action` | 3 | Особые | Изменить действие | executor.ts L??? |
| `choose_card_type` | 1 | Особые | Выбрать тип карты | executor.ts L??? |
| `modify_win_condition` | 1 | Флаги | Изменить условие победы | executor.ts L??? |
| `modify_hand_limit` | 1 | Флаги | Изменить лимит руки | executor.ts L??? |
| `set_flag` | 4 | Флаги | Установить флаг | executor.ts L??? |
| `shuffle_deck` | 15 | Колода | Перетасовать | executor.ts L??? |
| `mega_shuffle` | 1 | Колода | Всё в колоду → тасовка | executor.ts L??? |
| `reorder_top` | 2 | Колода | Изменить порядок верха | executor.ts L??? |
| `mill_until` | 1 | Колода | Сброс до условия | executor.ts L??? |
| `scry` | 2 | Колода | Просмотр + перестановка | executor.ts L??? |

> **Пробел:** `transfer`, `protect`, `grant_immunity`, `goto_end_turn` есть в executor, нет в catalog.v2.json.

---

## 2. Триггеры (Trigger)

| trigger | Count | Описание |
|---|---|---|
| `while_in_stable` | ~75 | Пока в стойле (статическая способность) |
| `on_enter_stable` | ~20 | При входе в стойло |
| `on_leave_stable` | ~5 | При выходе из стойла |
| `on_play` | ~15 | При розыгрыше |
| `when_destroyed` | ~8 | Когда уничтожена |
| `on_turn_start` | ~10 | В начале хода владельца |
| `on_turn_end` | ~5 | В конце хода владельца |
| `on_opponent_play` | ~3 | Когда оппонент играет карту |
| `on_opponent_plays_unicorn` | ~3 | Оппонент играет единорога |
| `on_opponent_plays_spell` | ~2 | Оппонент играет заклинание |
| `on_opponent_plays_upgrade_downgrade` | ~2 | Оппонент играет усиление/ослабление |
| `on_opponent_plays_neigh` | ~1 | Оппонент играет Neigh |
| `on_opponent_unicorn_effect` | ~2 | Срабатывание эффекта единорога оппонента |
| `on_opponent_sacrifices` | ~2 | Оппонент жертвует |
| `on_opponent_would_draw` | ~1 | Оппонент собирается взять карту |
| `on_opponent_pull_baby` | ~1 | Оппонент забирает Малыша |
| `on_would_be_destroyed` | ~3 | Когда должна быть уничтожена |
| `on_would_be_destroyed_or_sacrificed` | ~2 | Когда должна быть уничтожена или пожертвована |
| `on_any_unicorn_sacrificed_or_destroyed` | ~1 | Любой единорог уничтожен/пожертвован |

> **immediate** — 0 вхождений в v2 (но код проверяет `trigger === 'immediate'` в 20 местах).  
> **Стадия 4/5 задач:** DetSys (UNICORNS.md) требует on_enter_stable → while_in_stable → on_turn_start → на события.

---

## 3. Стадии игры (для skip_phase, extra_action, limit_actions)

| Стадия | Описание |
|---|---|
| `begin_turn` | Начало хода (добор) |
| `draw` | Фаза добора |
| `action` | Фаза действия (розыгрыш карт) |
| `play` | Фаза розыгрыша (основная) |
| `end_turn` | Фаза конца хода |
| `turn` | Весь ход целиком |
| `neigh` | Окно реакции (5 с) |

---

## 4. Контекст выполнения

Эффекты исполняются в **executor.ts** (~2200 строк, 29 case в основном switch'е).

**Вход:**
- `state` — полное состояние игры
- `ctx` — контекст (actorId, sourceCardId, triggeredBy, selectedPlayers и т.д.)
- `effect` — объект эффекта из карты

**Жизненный цикл:**
1. Исполнитель получает `kind` из `action`
2. Определяет `scope` (self/opponent/any_player/all_players/others/all/chosen)
3. Собирает цели через `countAvailableTargets` (executor.ts ~L509)
4. Применяет эффект к каждой цели

**Схема `Action.kind` в данных:**
```json
{
  "kind": "destroy",
  "targets": {
    "scope": "any",
    "zone": "stable",
    "filters": { "card_group": "unicorn" },
    "quantity": { "value": 1 }
  },
  "optional": false,
  "requires_success_of_previous": false
}
```

---

## 5. Непокрытые тестами kind

См. `memory [#14]`: слепые зоны гейта — выдача тегов не покрыта, subtype-фильтры не имеют тестов.

**Кандидаты на тесты:**
- `transfer` — нет в каталоге
- `grant_immunity` — нет в каталоге
- `protect` — нет в каталоге
- `goto_end_turn` — нет в каталоге
- `draw` через v2 — не протестирован в полном объёме
- `choose_card_type`, `conditional_loop`, `pass_hands` — по 1 карте

---

## 6. Схема Mongoose (models/Card.ts)

**Текущие значения TRIGGERS:** 13 (while_in_stable, on_enter_stable, on_leave_stable и т.д.)  
**Проблема:** не сохранит on_opponent_*, on_would_be_*, when_destroyed и on_any_unicorn_*.  
**Решение:** расширить схему до 19 значений.

---

## 7. Маппинг EffectBuilderConfig → catalog.v2.json

| kind в админке | kind в executor | kind в данных | Статус |
|---|---|---|---|
| add | add | ✓ | ✅ |
| destroy | destroy | ✓ | ✅ |
| sacrifice | sacrifice | ✓ | ✅ |
| discard | discard | ✓ | ✅ |
| move | move | ✓ | ✅ |
| steal | steal | ✓ | ✅ |
| give | give | ✓ | ✅ |
| return | return | ✓ | ✅ |
| transfer | transfer | — | ❌ нет в v2 |
| swap | swap | ✓ | ✅ |
| search | search | ✓ | ✅ |
| reveal | reveal | ✓ | ✅ |
| shuffle_deck | shuffle_deck | ✓ | ✅ |
| reorder_top | reorder_top | ✓ | ✅ |
| protect | protect | — | ❌ нет в v2 |
| grant_immunity | grant_immunity | — | ❌ нет в v2 |
| prevent | prevent | ✓ | ✅ |
| ignore | — (хардкод) | — | ❌ |
| cancel | cancel | ✓ | ✅ |
| skip_phase | skip_phase | ✓ | ✅ |
| goto_end_turn | goto_end_turn | — | ❌ нет в v2 |
| skip_turn | skip_turn | ✓ | ✅ |
| extra_action | extra_action | ✓ | ✅ |
| limit_actions | limit_actions | ✓ | ✅ |
| modify_win_condition | modify_win_condition | ✓ | ✅ |
| set_flag | set_flag | ✓ | ✅ |
| draw | draw (pull) | ✓ | ✅ |
| draw_conditional | draw_conditional | ✓ | ✅ |
| draw_until_limit | draw_until_limit | ✓ | ✅ |
| force_discard | force_discard | ✓ | ✅ |
| force_play | force_play | ✓ | ✅ |
| mega_shuffle | mega_shuffle | ✓ | ✅ |
| mill_until | mill_until | ✓ | ✅ |
| peek | peek | ✓ | ✅ |
| modify_action | modify_action | ✓ | ✅ |
| modify_hand_limit | modify_hand_limit | ✓ | ✅ |
| reactive_trigger | reactive_trigger | ✓ | ✅ |
| redirect_target | redirect_target | ✓ | ✅ |
| restrict_action | restrict_action | ✓ | ✅ |
| return_to_hand | return_to_hand | ✓ | ✅ |
| pull | pull | ✓ | ✅ |
| scry | scry | ✓ | ✅ |
| pass_hands | pass_hands | ✓ | ✅ |
| choice | choice | ✓ | ✅ |
| choose_card_type | choose_card_type | ✓ | ✅ |
| choose_players | — | — | ❌ |
| conditional_loop | conditional_loop | ✓ | ✅ |
| copy_effects | copy_effects | ✓ | ✅ |