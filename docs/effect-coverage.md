# Карта покрытия: кто на самом деле исполняет каждый kind и триггер

Стадия 1 плана `docs/plan-effect-vocabulary.md`.
Дата замера: 12.11.2026. Исполнитель: Аналитик.
Последнее обновление (V7-2): 12.11.2026. Аналитик.

## Метод

1. Каталог `server/data/catalog.v2.json` (329 карт) разобран рекурсивно: собраны все значения
   `kind` в `effects[].actions[]` (с заходом в `choice.options[].actions[]` и `reactive_trigger`)
   и все значения `trigger`.
2. Поиск по **всему** `server/src/**/*.ts` (72 файла) для каждого значения.
3. Каждое вхождение классифицировано:
   - **диспетчер** — `case '<kind>':` в `switch`, `String(action.kind) === '<kind>'`, `eff.trigger === '<trigger>'`;
   - **только строка данных** — `{ kind: 'pull' }` в хардкод-блоке, `log.details.kind`, enum в схеме,
     валидатор, скрипт импорта. Исполнителем **не является**.
4. Вердикт **НИКТО** ставится только если по всему `server/src` нет ни одного диспетчера.

## Уточнение от 12.11.2026: статус триггера `while_in_stable`

В версии от 03.11.2026 триггер `while_in_stable` значился как **частично живой** (только маска `transforms_unicorn`).
Фактически диспетчер существует: в `triggerTurnStartEffects` (executor.ts, второй проход по stable текущего игрока)
все карты с `trigger = 'while_in_stable'` проходят через `resolveEffect` → `executeAction`.
Однако многие kind (`prevent`, `reactive_trigger`, `modify_hand_limit`, `restrict_action`, `modify_action`)
не имеют case в `executeAction` и падают в `default` (возвращают `false`).

**Таким образом:**
- `while_in_stable` как триггер — **живой** (диспетчер есть, эффекты вызываются).
- Но для части kind (kind без case в executeAction) вызов `executeAction` возвращает `false`,
  `resolveEffect` помечает `prevSucceeded = false`, и эффект молча скипается.
- Исключение: `set_flag`, `modify_win_condition` имеют case → работают корректно.

### Статус карт с while_in_stable (V7-3):

| Карта | kind(ы) в действии | Работает? |
|---|---|---|
| Видеоняня, Пандамониум, Котострофа, Выдропокалипсис | `set_flag` | ✅ да (case есть) |
| Воображаемый другорог | `modify_win_condition` | ✅ да (case есть) |
| Единорог-Пчелиная королева (prevented_action=play) | `prevent` | ✅ `isPlayPrevented` проверяет `'play'` |
| Радужная аура (prevented_action=destroy) | `prevent` | ✅ `isTargetableFor` проверяет `destroy` с V7-3 |
| Ослепляющий свет, Ленивцерог (prevented_action=on_enter_stable) | `prevent` | ✅ `triggerEnterEffectsFor` + `resolveEffect` подавляют с V7-3 |
| Колючая проволка, Крошечная конюшня, Триумфальный единорог, Стакан наполовину полон, Антимагический пузырь (effect[1]), Выпас запрещен, Налог на единорогов, Единорог 90 уровня, Единорог-кукловод, Теневой единорог | `reactive_trigger` | ✅ `triggerEnterEffectsFor` исполняет `on_enter_stable` с V7-3 (`barbed_wire`, `tiny_stable` — зелёные). Остальные события не реализованы. |
| Единорог голода | `modify_hand_limit` | ⚠️ `handLimitFor` (отдельный путь) — не через `isPlayPrevented`
| Антимагический пузырь (effect[0]) | `restrict_action` | ✅ `isPlayPrevented` обрабатывает `restrict_action` с `play_spell` + `magic` |
| Единорог-нулевой пациент, Параллельный вселеннорог, Страшный единорог-пират | `modify_action` | ✅ `executeAction` → `case 'sacrifice'` читает modify_action с V7-3 (patient_zero — зелёный). Только sacrifice quantity. |
| Похищение единорогов | `sacrifice` (condition с count_in_zone) | ⚠️ sacrifice жив, но condition-движок не тестировался |

---

## Таблица 1. 43 kind из каталога

| kind | карт в v2 | executor.ts | gameService.ts | хардкод | вердикт |
|---|---|---|---|---|---|
| sacrifice | 39 | `case 'sacrifice'` L677, L1094, L1672 | — | — | **живой** |
| discard | 34 | `case 'discard'` L678, L1071, L1627 | — | — | **живой** |
| search | 22 | `case 'search'` L686, L1736 | — | — | **живой** |
| draw | 21 | `String(action.kind) === 'draw'` L962 (до `switch`, в обход union) | — | — | **живой, вне `ActionKind`** |
| destroy | 19 | `case 'destroy'` L668, L978, L1700 | — | — | **живой** |
| move | 18 | `case 'move'` L680, L1157 | — | — | **живой** |
| shuffle_deck | 17 | `case 'shuffle_deck'` L1797 | — | — | **живой** |
| steal | 17 | `case 'steal'` L681, L1407 | — | — | **живой** |
| reactive_trigger | 10 | `updateStableEffect` L29 регистрирует; `triggerEnterEffectsFor` L546 исполняет `on_enter_stable` | — | **живой (только on_enter_stable)** |
| return | 9 | `case 'return'` L684, L1238 | — | — | **живой** |
| cancel | 9 | — | L2054, L2091 — только `details.kind = 'cancel'` в логе реакции, не диспетчер | — | **НИКТО** (реакционный слой отменяет по `cancelLevel`, не по kind карты) |
| force_discard | 8 | `extraKind === 'force_discard'` L658, L955→`executeForceDiscard` | — | — | **живой, вне `ActionKind`** |
| prevent | 8 | `isPlayPrevented` L422 — диспетчер для `prevented_action === 'play'`; `isTargetableFor` L461 — для `destroy`; `triggerEnterEffectsFor` L585 — для `on_enter_stable`; `resolveEffect` L999 — подавление входящих эффектов | — | — | **живой** (play + destroy + on_enter_stable) |
| skip_phase | 6 | `case 'skip_phase'` L1557 | — | — | **живой** |
| choice | 6 | L856 явно: «choice требует UI await_choice» → не реализован | `pending.kind === 'await_choice'` L60, L2025, L2130 — это вид pending, а не `ActionKind` | — | **НИКТО как kind** (есть суррогат: pending `await_choice`) |
| pull | 6 | `extraKind === 'pull'` L658, L954→`executePull` | — | — | **живой, вне `ActionKind`** |
| return_to_hand | 6 | `extraKind === 'return_to_hand'` L662, L955 | — | — | **живой, вне `ActionKind`** |
| set_flag | 4 | `case 'set_flag'` L1587 | — | `unicornTypes.ts:87` читает `set_flag`+`transforms_unicorn` (маска) | **живой** |
| add | 3 | `case 'add'` L1053 | — | — | **живой** |
| give | 3 | `case 'give'` L682, L1237 | — | — | **живой** |
| limit_actions | 3 | `case 'limit_actions'` L1578 | — | — | **живой** |
| reveal | 3 | `case 'reveal'` L1372 | — | — | **живой** |
| modify_action | 3 | `updateStableEffect` L29 регистрирует; `executeAction`→`case 'sacrifice'` L1428 читает modify_action | — | **живой (только sacrifice quantity)** |
| reorder_top | 2 | `case 'reorder_top'` L1493 | — | — | **живой** |
| scry | 2 | — | — | — | **НИКТО** (`analyzeUnicornsRules.ts` — анализатор, не рантайм) |
| restrict_action | 2 | `isPlayPrevented` L422 — диспетчер для `action_type === 'play_spell' && card.type === 'magic'`; `updateStableEffect` L29 регистрирует | — | — | **живой** (только play_spell+magic ограничение) |
| force_play | 2 | — | — | — | **НИКТО** |
| extra_action | 1 | `case 'extra_action'` L1806 | — | — | **живой** |
| swap | 1 | `case 'swap'` L683, L1310 | — | — | **живой** |
| mega_shuffle | 1 | — | — | — | **НИКТО** |
| copy_effects | 1 | — | — | — | **НИКТО** |
| peek | 1 | — | — | — | **НИКТО** |
| conditional_loop | 1 | — | — | — | **НИКТО** |
| pass_hands | 1 | — | — | — | **НИКТО** |
| mill_until | 1 | — | — | — | **НИКТО** |
| draw_conditional | 1 | — | — | — | **НИКТО** |
| skip_turn | 1 | — | — | — | **НИКТО** |
| draw_until_limit | 1 | — | — | — | **НИКТО** |
| redirect_target | 1 | — | — | — | **НИКТО** (перенаправление живёт в реакционном окне `reactRedirect` L1022, но не как kind карты) |
| modify_win_condition | 1 | `case 'modify_win_condition'` L1615 | — | — | **живой** |
| choose_players | 1 | — | — | — | **НИКТО** |
| choose_card_type | 1 | — | — | — | **НИКТО** |
| modify_hand_limit | 1 | `handLimit.ts` — отдельный путь; `updateStableEffect` L29 регистрирует | — | — | **живой через handLimitFor, не через executor** |

### Сводка по kind

- **Живых: 22.** Из них 4 (`draw`, `pull`, `force_discard`, `return_to_hand`) исполняются в обход
  `switch` через `String(action.kind)` (L656–662, L854–856, L948–962) и **отсутствуют в union
  `ActionKind`** (`shared/src/types.ts`) — типовая проверка их не признаёт.
- **НИКТО: 21 kind — 55 вхождений (карта×kind), это 49 уникальных карт** (одна карта может нести
  несколько мёртвых kind).
- Мёртвый `case 'sacrifice'` L1668 — недостижимая ветка внутри второго `switch` (см. память #26),
  на вердикт не влияет: `sacrifice` жив через L1094 и L1672.
- В `executor.ts` есть `case` для `transfer`, `protect`, `grant_immunity`, `goto_end_turn` —
  **в каталоге v2 этих kind нет вообще**: реализовано больше, чем лежит в данных.

### Проверка гипотезы Аналитика про реакционный слой

Кандидаты `cancel`, `prevent`, `reactive_trigger` **не исполняются** реакционным слоем как kind карты:

- `reactNeigh` L1439, `reactSuperNeigh` L1728, `reactRewind` L1653, `reactCounterNeigh` L1512 —
  работают по `instant_subtype` и `cancelLevel` окна, `kind` карты не читают;
- `reactPrevent` L1362, `reactShield` L1894, `reactIgnoreTarget` L1399, `reactRedirect` L1022,
  `reactIntercept` L1325, `reactInterceptSteal` L1241, `reactHypnorog` L1574, `reactObjection` L1938,
  `reactPlayAsInstant` L1846, `reactFrankencornIntercept` L1789 — все по `pending`-окну и подтипу;
- то есть механика отмены/защиты в игре **есть**, но она не вызывается данными карты.
  Чтобы повесить её на карту, нужен исполнитель `kind: 'cancel' | 'prevent' | 'reactive_trigger'`
  в executor, который открывает/применяет соответствующее окно.

Вывод: цифра «68 карт с мёртвым поведением» реакционным слоем **не уменьшается**. Она уточняется до
49 карт по kind + 20 карт по триггерам; пересечение 15 карт, **объединение — 54 карты**,
то есть 54 из 154 эффектных карт (35%) несут хотя бы одно мёртвое поведение.

---

## Таблица 2. 19 триггеров из каталога

| trigger | карт в v2 | диспетчер (файл:строка) | вердикт |
|---|---|---|---|
| on_enter_stable | 60 | `executor.ts:586` внутри `triggerEnterEffectsFor` (драйвер данных, вариант 1), + хардкод-блоки L392–L578 | **живой, данные исполняются; хардкод гасится при `hasDataEnter`** |
| on_turn_start | 35 | `executor.ts:244` (общий цикл), `executor.ts:155` (опциональный промпт), `gameService.ts:122`, `routes/game.ts:434/536` | **живой** |
| on_play | 30 | `executor.ts:593` (loop с окном реакции), `executor.ts:373` (magic/instant через `play_now`) | **живой** |
| while_in_stable | 24 | `executor.ts:10310` (второй проход `triggerTurnStartEffects`) — диспетчер зовёт `resolveEffect` на каждый action | **живой** с оговорками (см. уточнение выше) |
| when_destroyed | 11 | `executor.ts:622` в `triggerDestroyedEffectsFor` | **живой** |
| on_would_be_destroyed | 4 | — | **НИКТО** |
| on_opponent_play | 4 | — | **НИКТО** |
| on_turn_end | 2 | `gameService.ts:787` — цикл по `stable` текущего игрока | **живой** |
| on_opponent_plays_unicorn | 2 | — | **НИКТО** |
| on_would_be_destroyed_or_sacrificed | 1 | — | **НИКТО** |
| on_opponent_unicorn_effect | 1 | — | **НИКТО** |
| on_leave_stable | 1 | — | **НИКТО** |
| on_opponent_pull_baby | 1 | — | **НИКТО** |
| on_opponent_plays_upgrade_downgrade | 1 | — | **НИКТО** |
| on_any_unicorn_sacrificed_or_destroyed | 1 | — | **НИКТО** |
| on_opponent_plays_neigh | 1 | — | **НИКТО** |
| on_opponent_plays_spell | 1 | — | **НИКТО** |
| on_opponent_sacrifices | 1 | — | **НИКТО** |
| on_opponent_would_draw | 1 | — | **НИКТО** |

### Сводка по триггерам

- **Живых: 7**, из них `while_in_stable` — живой диспетчер, но часть kind внутри падает в default → false.
- **НИКТО: 13 триггеров, 20 карт.** Все 9 «оппозитных» триггеров (`on_opponent_*`) мертвы целиком.
- `immediate` — не значение каталога. 16 мест проверяют `trigger === 'immediate'`: `gameService.ts` 9,
  `routes/game.ts` 5, `executor.ts` 1, `routes/import.ts` 1 — и для v2 эта ветка не срабатывает никогда.
- Триггеры, встречающиеся в коде, но отсутствующие в каталоге: `when_enters`,
  `when_other_plays`, `when_other_brings_baby_from_nursery`,
  `when_other_unicorn_would_be_sacrificed_or_returned` (только `routes/import.ts` — конвертер).

---

## Что из этого следует для стадии 2

1. **Контракт данных.** `ActionKind` должен содержать 22 живых + то, что закроем в стадии 3.
   Минимум — добавить `draw`, `pull`, `force_discard`, `return_to_hand` (сегодня вне типа, но работают).
2. **Порядок реализации kind (стадия 3).** Добор/поиск: `draw_until_limit`, `draw_conditional`, `peek`,
   `scry`, `mill_until`. Перемещение: `pass_hands`, `mega_shuffle`. Ход: `skip_turn`, `restrict_action`,
   `modify_action`, `modify_hand_limit`, `force_play`. Выбор: `choose_players`, `choose_card_type`,
   `conditional_loop`, `copy_effects`. Реакции: `cancel`, `prevent`, `reactive_trigger`, `redirect_target`.
3. **Триггеры (стадия 4).** Сначала `while_in_stable` целиком — диспетчер есть, но нужны case для
   `prevent`, `reactive_trigger`, `modify_hand_limit`, `restrict_action`, `modify_action` в executeAction.
   Затем `on_would_be_destroyed` (4), затем группа `on_opponent_*` (9 триггеров).
4. **`dispatchTrigger`.** Сейчас триггеры размазаны по 7 функциям (`triggerTurnStartEffects` включает
   while_in_stable, `triggerEnterEffectsFor`, `triggerDestroyedEffectsFor`, цикл `on_turn_start`,
   цикл `on_turn_end`, `play_now`, `maskOfCard`). Единая точка `dispatchTrigger(state, player, cardId, trigger)`
   нужна до стадии 4, иначе каждый новый триггер — ещё одно место поиска.

## Ограничения замера

- Проверен только `server/src`. Клиент (`client/src`) не сканировался: он не исполняет эффекты.
- Пересечение множеств «карта с мёртвым kind» и «карта с мёртвым триггером» **посчитано**: пересечение
  15 карт, объединение 54. Разбор по `id` карт остаётся задачей стадии 3 (фикстуры).
- Проверялось наличие диспетчера, а не корректность его поведения: живой kind может исполняться
  неправильно (известные дефекты #26 — `destroy` пишет в `owner.discard`, а `search`/`move` читают
  `state.discard`).