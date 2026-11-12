# GAME_RULES.md — Анализ механик «Неудержимые единороги»

> Сверка реализации с оригинальной настольной игрой Unstable Unicorns.
> Проверены: `executor.ts` (2106 строк), `routes/game.ts` (1162 строки), `gameInstance.ts`, `API_CONTRACT.md`, `useSocket.ts`, `canReactFlags.ts`, `unicornTypes.ts`.

## Сводка

| № | Механика | Статус | Ключевой источник в коде |
|---|---|---|---|
| 1 | Neigh-цепочки | ⚠️ частично | cancelLevel в game.ts L787, L1054 — всегда 0 |
| 2 | Super Neigh = 2 веса | ❌ | NEIGH_WEIGHT=0 в executor; cancelLevel −2 в game.ts не подтверждён (оба =0) |
| 3 | Приоритеты отмен / cancelLevel | ❌ | cancelLevel=0 hardcoded; цепочек нет, NEIGH_WEIGHT=0 |
| 4 | Маски / Pandamonium / Cat-astrophe | ❌ | blocks_unicorn_effects только гипнорог (L565); нет transform effect |
| 5 | Resolution order | ❌ | 0 isCancelled/isPrevented в executor |
| 6 | Nursery (Ясли) | ✅ | isNurseryOnly() + source_zone; game.ts L10,137,153,195,203 |
| 7 | Hand Limit | ❌ | только в контракте, реализации 0 |
| 8 | Победа 7 единорогов | ✅ | getWinningScore() = 7 |
| 9 | Окно реакций / canReact | ⚠️ частично | canReactFlags на сервере, клиент не читает players[].canReact |
| 10 | skip_phase / goto_end_turn | ⚠️ неполно | goto_end_turn=1 в executor; 0 skip_phase |

---

## 1. Neigh и Super Neigh

**Оригинал:** После розыгрыша карты открывается окно реакции. Любой противник может сыграть Neigh из руки. Каждое Neigh открывает новое окно — следующий игрок может контратаковать. Super Neigh считается за 2 обычных Neigh. Цепочка закрывается, когда все пасуют или истекает время.

**Реализация:**
- `routes/game.ts`: обработчики `/react/neigh` и `/react/super_neigh` (L1030). Поддерживают `cancelLevel` (Memory #14): Super Neigh выставляет −2, обычное Neigh −1.
- `executor.ts`: **0 вхождений** `cancelLevel`, `NEIGH_WEIGHT`, `neighWeight`, `superNeigh`/`super_neigh`. При игре через `gameInstance.ts` Neigh-цепочки не работают (cancelLevel = 0 всегда).
- `canReactFlags.ts`: сервер знает, какие карты могут реагировать.

**Проблемы:**
1. Два движка — полный (routes/game.ts) и упрощённый (gameInstance.ts). Neigh-цепочки есть только в первом.
2. В `executor.ts` нет поля `NEIGH_WEIGHT` в Action → эффекты не могут указать «вес» реакции.
3. При одновременных Neigh от нескольких игроков очерёдность не определена.

**Рекомендация:**
- Добавить `NEIGH_WEIGHT: number` в Action.
- Перенести cancelLevel-логику из route-хендлеров в executor.
- Добавить очередь приоритетов для одновременных реакций.

---

## 2. Маски / Трансформации

**Оригинал:** Pandamonium, Cat-astrophe, Otter Possibility, Poop Downgrade — карты, блокирующие способности единорогов, меняющие их тип или накладывающие запрет. Часто действуют «до разрешения других карт» (высший приоритет).

**Реализация:**
- `executor.ts`: **0 вхождений** `pandamonium`, `cat-astrophe`, `otter`, `poop`. 5 вхождений `Mask` — все в комментариях.
- `shared/types.ts`: ActionKind не содержит `transform`, `set_flag`, `block_ability`.

**Проблемы:**
- Механика маски не реализована ни на одном уровне исполнения.
- В ActionKind не хватает типов для трансформации/блокировки.
- Карты с масками из `unicorns.json` будут разыграны, но эффекты не сработают.

**Рекомендация:**
- Добавить в эффекты: `transform` (смена типа карты), `set_flag` (флаг блокировки), `block_unicorn` (запрет активации).
- В executor: обработчик `action.kind === 'transform'`.

---

## 3. Resolution Order (очередь приоритетов)

**Оригинал:** Карты разрешаются по приоритету (1 — наивысший). Некоторые карты (Pandamonium, Cat-astrophe) — «до разрешения других». При одновременных триггерах эффекты выполняются по приоритету. Эффект может быть отменён/предотвращён картой с бóльшим приоритетом.

**Реализация:**
- `executor.ts`: **0 вхождений** `isCancelled`, `isPrevented`, `cancelledActions`, `preventedActions`, `resolveCancel`, `resolvePrevent`.
- Нет очереди приоритетов. `goto_end_turn` есть (1 вхождение) — но он не для разрешения конфликтов.

**Проблемы:**
- При одновременных триггерах (`on_enter_stable` двух карт) порядок не определён.
- Карты с «предотвратить/отменить» нереализуемы без priority-системы.
- `cancelLevel` — единственный механизм приоритета, только в game.ts и только для Neigh.

**Рекомендация:**
- Ввести `priority: 1|2|3|4|5` в эффекты.
- Добавить `resolveQueue`: перед выполнением группировать эффекты по триггеру, сортировать по priority.
- Добавить в ActionKind: `cancel` / `prevent`.

---

## 4. Nursery (Ясли)

**Оригинал:** Baby Unicorns находятся в Nursery (отдельная зона). При уничтожении, возврате в руку или жертвовании возвращаются в Nursery. Игрок берёт Baby из Nursery в стойло особым действием.

**Реализация:** ✅
- `unicornTypes.ts`: предикат `isNurseryOnly()` на `source_zone === 'nursery_only'`.
- Каждой Baby в `catalog.v2.json` проставлен `source_zone`.
- `routes/game.ts`: L10, L137, L153, L195, L203 — проверки `isNurseryOnly()`.
- При возврате/уничтожении Baby уходит в Nursery, а не в руку/сброс.

**Вывод:** Nursery реализована корректно. Изменений не требуется.

---

## 5. Hand Limit (Лимит руки)

**Оригинал:** Макс. 7 карт в руке. При превышении в конце хода — сброс до лимита. Black Lotus Downgrade уменьшает лимит.

**Реализация:**
- `API_CONTRACT.md`: `PendingAction.purpose = 'hand_limit'` — задекларирован.
- `useSocket.ts`: `resolve_pending` — может обрабатывать hand_limit.
- `game.ts` / `executor.ts`: **реализация не найдена** — нет проверки превышения при draw_card, нет принудительного сброса при end_turn, нет эффекта уменьшения handLimit.

**Статус:** ❌ (не реализован).

---

## 6. Победа (7 единорогов)

**Оригинал:** Первый собравший 7 единорогов в стойле побеждает.

**Реализация:** ✅
- `gameInstance.ts`: `getWinningScore()` = 7, `winScore()` с guard от RangeError при < 2 игроках.
- `routes/game.ts`: проверка победы при `/play` и `/endTurn`.
- `API_CONTRACT.md`: `winnerId`, `gameOver` в GameState.

---

## 7. Окно реакций / canReact

**Оригинал:** После розыгрыша карты — окно реакции. Противники могут сыграть карты-реакции (Neigh, Baby, Shield и т.д.). Окно открывается повторно после реакции.

**Реализация:**
- `canReactFlags.ts`: сервер вычисляет canReact флаги.
- `API_CONTRACT.md`: `PlayerState.canReact: boolean[]` — сервер передаёт клиенту.
- Клиент (`useSocket.ts` / `neighOptions.ts`): при получении `state_update` **не читает** `players[].canReact`. Вместо этого самостоятельно вычисляет реакции, фильтруя hand cards по `instant_subtype`.
- `AwaitChoiceModal.tsx`: модалка при `pending.kind === 'await_choice'` — работает.

**Проблемы:**
- Клиент игнорирует `canReact` от сервера → может показывать кнопку реакции, когда сервер её не ожидает → 400/BAD_REQUEST.
- `neighOptions.ts` дублирует серверную `canReactFlags.ts` → риск расхождения.

**Рекомендация:**
- В `GameRoom.tsx` добавить проверку `state.players[meIdx].canReact` перед показом кнопки реакции.
- Синхронизировать/убрать дублирующую логику из `neighOptions.ts`.

---

## 8. Приоритеты карт: cancelLevel и цепочка отмен

**Оригинал:** Каждое сыгранное Neigh открывает новое окно — следующий игрок может контратаковать. Super Neigh считается за 2 обычных, требует 2 ответных Neigh или 1 Super Neigh для отмены. Карты с `cannot_be_neighed` (Super Neigh, Neigh Means Neigh, Elusive Oceloticorn) не могут быть отменены обычным Neigh — только особым действием (Rewind снимает Super Neigh с cancelLevel −2 по Memory #14).

**Реализация cancelLevel в коде (game.ts):**

```
L787:  entry.pending = { kind:'play', actorId, cardId,
         prefill: { targets, playerId },
         cancelLevel: 0, expiresAt: Date.now() + 5000,
         uncounterable }

L1054: entry.pending = { kind:'play', actorId, cardId,
          cancelLevel: 0, expiresAt: Date.now() + 5000,
          uncounterable }
```

- **cancelLevel = 0** в обоих вызовах `entry.pending`. Значение не меняется: для обычной карты и для Super Neigh одинаковое. Цепочки с разной глубиной нет — каждый pending открывает 5-секундное окно, которое закрывается по таймеру или реакции, и новое окно не создаётся с учётом остаточного cancelLevel.
- **expiresAt: Date.now() + 5000** — жёстко 5 секунд (CONFIRM_WINDOW_MS = 5000).
- **uncounterable**: L786 (play path) — `firstOnPlay.uncounterable` из данных карты; L1053 (react path) — `dangerousEff.uncounterable || isElusiveOceloticorn || cdef.cannot_be_neighed === true`. Uncouncerable = `true` означает, что pending не может быть отменён — не создаёт окна для контратаки.
- **NEIGH_WEIGHT**: 0 вхождений в executor.ts и 0 в Action. Нет понятия «вес» реакции. Карта Super Neigh не имеет механизма, отличающего её от обычного Neigh кроме названия.

**Вывод: cancelLevel=0 в обоих путях, цепочек с накоплением глубины не существует. NEIGH_WEIGHT отсутствует.**

**Проверка `cannot_be_neighed`:**
- `cannot_be_neighed` — статический флаг на карте. Установлен в данных `catalog.v2.json` у: Super Neigh, Super Neigh (C&C), Neigh Means Neigh. Elusive Oceloticorn — свой флаг `blocks_neigh_for_others + cannot_be_neighed`.
- В коде проверка L1053 применяет `cannot_be_neighed` для uncounterable, но не влияет на cancelLevel.

**Иерархия отмен в оригинале vs реализация:**

| Сценарий | Оригинал | Реализация |
|---|---|---|
| Обычная карта → Neigh | Успешно отменена через 1 Neigh | ✅ — окно 5 сек, Neigh отменяет |
| Super Neigh → Neigh | НЕ отменён (вес 2 > 1) | ❌ — cancelLevel=0, отменяется 1 Neigh |
| Super Neigh → 2×Neigh | Успешно отменён (1+1 ≥ 2) | ❌ — второй Neigh не нужен |
| Super Neigh → Super Neigh | Успешно отменён (2 ≥ 2) | ✅ — 1 Super Neigh хватает (но это случайность, не расчёт) |
| cannot_be_neighed → любое Neigh | Не отменяется | ✅ — uncounterable=true |

**Рекомендация:**
1. Ввести поле `neighWeight: 1|2` в эффект карты (Action). 1 — обычный Neigh, 2 — Super Neigh. Хранить в `catalog.v2.json`.
2. В `entry.pending` начальный `cancelLevel` выставлять равным `neighWeight` играемой карты. Обычная карта → cancelLevel=0, Super Neigh → cancelLevel=2.
3. При реакции: `entry.pending.cancelLevel -= neighWeight` реакции. Если ≤ 0 — реакция отменяет. Если > 0 — окно переоткрывается с остаточным cancelLevel.
4. `cannot_be_neighed === true` → cancelLevel игнорируется, uncounterable=true.
5. Перенести логику из `routes/game.ts` в `executor.ts`, чтобы `gameInstance.ts` тоже поддерживал цепочки.

---

## 9. Маски (Pandamonium, Cat-astrophe, Otter Possibility, Poop Downgrade)

**Оригинал:** Карты-маски — ослабляющие (downgrade) карты, которые при входе в стойло накладывают блокирующий эффект. Pandamonium меняет тип цели на «панда», Cat-astrophe — на «кот», etc. Маски работают «до разрешения других карт» (приоритет 1). Заблокированный единорог не использует свои эффекты и не может быть целью чужих способностей. Маска активна, пока она сама в стойле.

### Блокировка `blocks_unicorn_effects`

```typescript
// routes/game.ts L565-569 — единственное использование:
// Правило Гипнорога: гасит тот соперник, у кого в стойле карта с blocks_unicorn_effects
function targetCheck(c: any): boolean {
  return c && (c.blocks_unicorn_effects === true);
}
```

- `executor.ts`: **0 вхождений** `blocks_unicorn_effects`. Движок карт не проверяет этот флаг.
- Флаг влияет только на выбор цели Гипнорога, не на выполнение эффектов.

### Существующая защита (статическая)

| Флаг | executor.ts строка | Действие | Статус |
|---|---|---|---|
| `cannot_be_targeted` | L303, L319 | `isActionPossible` и `isTargetableFor` возвращают false для hostile действий | ✅ работает, но **статический** — задан в JSON карты, не накладывается эффектом маски |
| `immune: string[]` | L298, L321 | Массив action kind, от которых карта защищена (steal, destroy…) | ✅ работает, **статический** — в данных карты |
| `neighproof` (тег) | L321 | Дополнительная защита от кражи | ✅ работает, **статический** |
| `cannot_be_neighed` | L1053 (game.ts) | Uncounterable при реакции | ✅ работает, но не в executor |

### Чего нет для масок

| Требование маски | Необходимый механизм | Статус в коде |
|---|---|---|
| «Поменять тип цели» (unicorn → panda) | `action.kind: 'transform'` с параметром `toType:` | ❌ нет такого ActionKind |
| «Заблокировать эффекты цели» | Проверка `blocks_unicorn_effects` в цикле `executeAction` | ❌ 0 вхождений в executor |
| «Цель не может быть выбрана» | `set_flag: { flag: 'cannot_be_targeted', duration: 'while_source_in_stable' }` | ❌ set_flag нет; cannot_be_targeted — статика |
| «Снять маску» | `remove_flag` или `cleanse` | ❌ нет |
| «Приоритет 1 (до других)» | `priority: 1` в эффекте | ❌ нет priority в Action/Effect |

### Рекомендация по реализации

1. **Добавить `action.kind: 'set_flag'`**:
   ```typescript
   { kind: 'set_flag', flag: 'cannot_be_targeted', value: true,
     duration: 'while_source_in_stable', sourceCardId: 'self' }
   ```
   Executor: при исполнении `set_flag`, установить флаг на карте-цели. При `sourceCardId` уходе из стойла — снять флаг.

2. **Добавить `action.kind: 'transform'`**:
   ```typescript
   { kind: 'transform', toType: 'downgrade', toSubtype: 'panda',
     duration: 'while_source_in_stable', sourceCardId: 'self' }
   ```
   Executor: меняет `card.type` и `card.subtype` цели. При уходе источника — восстанавливает оригинал.

3. **Проверка `blocks_unicorn_effects` в executor**:
   В цикле `executeAction` (или на входе в `executeAction`) проверять: если у цели есть карта с `blocks_unicorn_effects` в стойле, эффект не применяется (кроме собственных эффектов этой карты-блокировщика).

4. **`cannot_be_targeted` как динамический флаг**:
   В `isTargetableFor` (L303, L319) добавить проверку не только статического `card.cannot_be_targeted`, но и динамического `card.flags?.cannotBeTargeted`, устанавливаемого эффектом `set_flag`.

5. **ActionKind для масок**: добавить в `shared/types.ts`:
   ```
   'transform' | 'set_flag' | 'remove_flag' | 'cleanse'
   ```

---

## 10. Исключения — аннотированный порядок доработок

Каждая строка таблицы содержит ссылку на код, обосновывающую приоритет.

| # | Задача | Обоснование кодом | Файл:Строка |
|---|---|---|---|
| 1 | **NEIGH_WEIGHT + cancelLevel в executor** | cancelLevel=0 hardcoded в L787, L1054 game.ts; NEIGH_WEIGHT=0 в executor; Super Neigh не требует 2 отмен — баланс сломан | `game.ts:787,1054` `executor.ts:0` |
| 2 | **Расширение ActionKind (42→58+) + TRIGGERS (13→19)** | 29 kind исполняется, но ActionKind union в shared/types.ts неполон; TRIGGERS не принимают while_in_stable (24 карты), on_opponent_*, on_leave_stable | `shared/types.ts` `models/Card.ts` `executor.ts:29kind` |
| 3 | **Маски / трансформации (set_flag, transform)** | 0 вхождений pandamonium/cat-astrophe/transform; blocks_unicorn_effects только в game.ts L565; cannot_be_targeted статический | `executor.ts L303` `game.ts L565-569` |
| 4 | **Resolution order (priority в эффектах)** | 0 isCancelled/isPrevented; нет сортировки эффектов по priority; при on_enter_stable двух карт порядок не определён | `executor.ts` |
| 5 | **canReact на клиенте** | PlayerState.canReact не читается; neighOptions.ts дублирует серверную canReactFlags.ts → кнопка 400 | `client/.../neighOptions.ts` `canReactFlags.ts` |
| 6 | **skip_phase / goto_end_turn для цели** | goto_end_turn 1 вхождение в executor L1566; 0 skip_phase; нет пропуска хода для другого игрока | `executor.ts L1566` |
| 7 | **Hand Limit (force_discard + handLimit эффект)** | handLimit в контракте только; draw_card не проверяет лимит; end_turn не сбрасывает; Black Lotus не реализован | `routes/game.ts` `executor.ts` |

### Обоснование строк

**Строка 1.** Прямой замер `cancelLevel` в `routes/game.ts` дал `0` в обоих вызовах `entry.pending` (L787 — розыгрыш карты, L1054 — реакция). `NEIGH_WEIGHT` — 0 в `executor.ts` и 0 match в `game.ts`. Без этого Super Neigh — обычный Neigh с другим названием. **Баланс: критический** — карта «Super Neigh» стоит 2 действия по правилам, но реализована как 1.

**Строка 2.** Executor исполняет 29 разных `action.kind`, включая **draw, pull, force_discard, return_to_hand**, но `shared/src/types.ts` не включает их в union `ActionKind`. Mongoose `Card.ts` TRIGGERS enum = 13 значений, а в каталоге встречаются 19. Без расширения схемы карты с `while_in_stable` не сохранятся в БД.

**Строка 3.** `blocks_unicorn_effects` — единственный флаг блокировки, проверяется только в правиле Гипнорога (`game.ts L565`, функция `targetCheck`). В `executor.ts` этот флаг не обрабатывается, поэтому маски (Pandamonium, Cat-astrophe, Poop) при входе в стойло не блокируют эффекты цели. `cannot_be_targeted` есть, но статический — задаётся в JSON карты, не накладывается эффектом маски. **Влияет на ~10 карт каталога v2.**

**Строка 4.** `isCancelled`, `isPrevented`, `resolveCancel`, `resolvePrevent` — 0 вхождений в executor и game.ts. Нет очереди приоритетов: при одновременном входе двух карт в стойло (`on_enter_stable`) порядок их выполнения не определён. `cancelLevel` — единственный механизм приоритета, но он сhardcoded=0.

**Строка 5.** `neighOptions.ts` на клиенте фильтрует hand cards по `instant_subtype === 'neigh | super_neigh'`. Это дублирует серверную логику `canReactFlags.ts`. Если сервер не добавит флаг, клиент покажет кнопку → 400. `PlayerState.canReact` из state_view не читается.

**Строка 6.** Один вызов `goto_end_turn` в executor (L1566) — в `executeAction`. `skip_phase` и `skipPhase` = 0 вхождений. Нет пропуска отдельной фазы (только целиком goto_end_turn). Нет пропуска хода для другого игрока (targetPlayerId + goto_end_turn).

**Строка 7.** `PendingAction.purpose = 'hand_limit'` есть в контракте, но `routes/game.ts` не проверяет `player.hand.length > handLimit` после `draw_card`, и `end_turn` не форсирует сброс. Black Lotus как эффект-ограничитель — отсутствует.

---

*Проверено: executor.ts, routes/game.ts, gameInstance.ts, API_CONTRACT.md, useSocket.ts, canReactFlags.ts, unicornTypes.ts, shared/types.ts, models/Card.ts*  
*Дата: 11.11.2026*