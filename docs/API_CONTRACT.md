# API_CONTRACT.md — Контракт Backend ↔ Frontend

> **Цель:** Фронтенд не гадает, какие данные присылает Бэкенд.
> Обновляется при изменении любого эндпоинта или события.
> **Актуальная версия:** 11.11.2026 — переписана под фактическое поведение кода (решение Даниила).

---

## 1. REST API (routes/game.ts)

Базовый URL: `/api/game/:gameId`

### 1.1 POST /play — разыграть карту с руки

```typescript
// Request
{
  cardId: string;
  targetPlayerId?: string;   // цель-игрок (upgrade/downgrade)
  targets?: string[];        // цели-карты (destroy/steal/sacrifice)
  chosenCostTargets?: string[];
}

// Response 200 — голый GameState, без обёртки
// Если открыто окно реакции:
{
  pending: PendingAction;   // окно реа��ции
  state: GameState;
}

// Response 4xx (отказ) — никакой обёртки, поля в корне:
{
  message: string;          // человекочитаемое сообщение
  // Поле code отсутствует в REST (только в socket-ack)
  // + любые поля из ServiceError.extra:
  needTargets?: boolean;
  kind?: string;
  options?: { targets?: string[]; players?: string[] };
  noSwapCandidates?: boolean;
  gameOver?: boolean;
  winnerId?: string;
}
```

**HTTP-статусы отказа:**
- `400` — большинство ошибок (WRONG_PHASE, NOT_YOUR_TURN, CARD_NOT_IN_HAND, NO_ACTION_POINTS, и т.д.)
- `409` — требуется цель (`needTargets`, `needTargetPlayer`, `noSwapCandidates`)
- `404` — игра или карта не найдена

### 1.2 POST /playWithTargets — разыграть с полным набором целей

```typescript
// Request
{
  cardId: string;
  targets?: string[];          // цели-карты
  targetPlayerId?: string;     // цель-игрок
  chosenCostTargets?: string[];
}

// Response 200 — голый GameState
// Response 409 — отказ (те же коды, что у /play)
```

### 1.3 POST /endTurn — завершение хода

```typescript
// Request
{}  // тело не требуется

// Response 200:
// Если окно hand_limit открыто:
{ pending: PendingAction, state: GameState }
// Если ход завершён:
<голый GameState>

// Response 4xx (отказ):
{
  message: string;
  gameOver?: boolean;
  winnerId?: string;
}
```

### 1.4 POST /react/:reaction — реакции

Маршруты: `neigh`, `super_neigh`, `redirect`, `shield`, `rewind`, `hypnorog`, `intercept_steal`, `intercept`, `prevent`, `objection`, `counter_neigh`, `frankencorn_intercept`, `play_as_instant`, `ignore_target`

```typescript
// Request
{
  byPlayerId?: string;
  instantCardId?: string;      // карта-реакция
  discardCardId?: string;      // сброс при цене
  targetId?: string;           // цель (redirect)
  toTargetId?: string;
  cardId?: string;
}

// Response 200 — голый GameState или { pending, state }
```

### 1.5 POST /resolvePending — разрешение окна выбора

```typescript
// Request
{
  cardId?: string;       // выбранная карта (для await_choice, archangel_prevent)
  skip?: boolean;        // отдельно не обрабатывается; для optional trigger_effect отказ задаётся отсутствием confirm:true
  byPlayerId?: string;   // кто отвечает (валидируется против владельца окна)
  confirm?: boolean;     // true = исполнить optional-эффект (для trigger_effect с optional:true)
  decline?: boolean;     // true = отказ от замены уничтожения (для archangel_prevent)
}

// Поведение по видам pending:
//
// kind === 'play':
//   Исполняет розыгрыш карты (performPlayNow) или завершает отмену (cancelLevel > 0).
//   Валидация: byPlayerId (если указан) обязан совпадать с actorId владельца окна.
//
// kind === 'turn_start_effect':
//   Исполняет отложенный эффект начала хода (on_turn_start).
//
// kind === 'trigger_effect' с optional === true:
//   confirm:true от владельца окна исполняет эффект, если окно не отменено.
//   Если confirm:true без byPlayerId или с чужим byPlayerId — HTTP 400.
//   * Если окно не отменено: запрос без confirm:true (включая skip:true, confirm:false или пустое тело)
//     закрывает его без исполнения и пишет optional_declined. Поле skip отдельно не проверяется.
//   * Если окно уже отменено (cancelLevel > 0), отмена обрабатывается раньше optional-ветки.
//   * Таймаут также отклоняет optional-эффект без исполнения.
//
// kind === 'trigger_effect' без optional:
//   Исполняет эффект при resolvePending, если окно не отменено (cancelLevel отсутствует или равен 0);
//   при cancelLevel > 0 фиксируется отмена и эффект не исполняется.
//
// kind === 'await_choice':
//   * cardId — выбранная карта из руки защитника.
//   * Валидация: карта должна быть в hand и среди pending.options.
//   * skip не обрабатывается: для обычного выбора без cardId будет HTTP 400.
//   * Для purpose === 'archangel_prevent':
//     - decline:true — отказ, уничтожение проходит штатно.
//     - cardId — сброс этой карты вместо уничтоженной.
//   * Для purpose === 'hand_limit':
//     - cardId обязателен; после сброса окно переоткрывается, если рука всё ещё выше лимита.
//
// Владелец окна:
//   Для await_choice это chooserId, для остальных pending — actorId.
//   Если byPlayerId передан и владелец окна определён, значение должно совпадать; иначе HTTP 400.
//   Для optional trigger_effect с confirm:true byPlayerId обязателен и должен совпадать с actorId.
//   В socket-событии resolve_pending byPlayerId подставляется сервером из участника соединения.

// Response 200:
// Если окно заменено новым (напр., await_choice внутри trigger_effect):
{ pending: PendingAction, state: GameState }
// Иначе:
<голый GameState>

// Response 4xx (отказ):
{
  message: string;          // например: 'Nothing pending', 'Not your reaction window',
                            //          'Card not in chooser hand', 'Not actor turn/phase'
  code?: string;            // опциональный машинный код: 'nothing_pending', 'CARD_NOT_IN_HAND'
}
```

**HTTP-статусы отказа:**
- `400` — нет pending, не ваш ход/фаза, не ваше окно реакции, карта не в руке
- `404` — игра не найдена

---

## 2. Socket-события (server/src/socket/handlers.ts)

### 2.1 Клиент → Сервер

| Событие | Тело | Ответ (ack) |
|---------|------|-------------|
| `join_game` | `{ gameId, playerId? }` | `SocketAck { ok: true, state?, pending?, logs? }` |
| `leave_game` | `{ gameId }` | `SocketAck` |
| `play_card` | `{ gameId, playerId, cardId, targets?, targetPlayerId? }` | `SocketAck` |
| `draw_card` | `{ gameId, playerId }` | `SocketAck` |
| `end_turn` | `{ gameId, playerId }` | `SocketAck` |
| `reaction` | `{ gameId, playerId, kind, instantCardId?, discardCardId?, targetId?, toTargetId? }` | `SocketAck` |
| `resolve_pending` | `{ gameId, playerId, body?, cardId?, skip? }` | `SocketAck` |

### 2.2 Сервер → Клиент (broadcast)

| Событие | Данные | Когда |
|---------|--------|-------|
| `state_update` | `<голый GameState>` | После любого успешного действия (без окна реакции) |
| `logs_update` | `LogEntry[]` | Вместе с state_update |
| `pending_update` | `<голый PendingAction>` | Когда открыто окно реакции |

### 2.3 SocketAck

```typescript
type SocketAck =
  | { ok: true; state?: GameState; pending?: any; logs?: LogEntry[] }
  | { ok: false; code: SocketErrorCode; message: string; extra?: any };
```

### 2.4 SocketErrorCode (заморожен контрактом)

```typescript
type SocketErrorCode =
  | 'GAME_NOT_FOUND'
  | 'BAD_REQUEST'
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_IN_HAND'
  | 'NO_ACTION_POINTS'
  | 'WRONG_PHASE'
  | 'PENDING_ACTION';
```

---

## 3. Ключевые типы данных

### GameState (engine/state.ts)

```typescript
interface GameState {
  players: PlayerState[];
  turn: {
    currentPlayerId: string;     // ID текущего игрока (не number!)
    phase: 'begin_turn' | 'draw' | 'action' | 'end_turn';
    has_drawn?: boolean;         // флаг добора в этом ходу
    skippedPhases?: string[];    // пропущенные фазы
  };
  cards: Record<string, Card>;   // все карты (полные данные)
  deck?: string[];               // колода (top at end)
  discard?: string[];            // общий сброс
  nursery?: string[];            // Ясли
  winnerId?: string;             // победитель (защёлка)
  optionalSkipped?: OptionalSkipRecord[];  // пропущенные optional
}

interface PlayerState {
  id: string;
  deck: string[];        // не используется (общая колода)
  hand: string[];
  discard: string[];
  stable: string[];
  nursery: string[];     // всегда пуст (Малыши в общем state.nursery)
  field: string[];
  action_points: number; // очки действий
  noNeighUntilEndOfTurn?: boolean;  // Objection
}
```

### PendingAction

```typescript
type PendingAction = {
  kind: 'play' | 'await_choice' | 'prompt' | 'turn_start_effect' | 'trigger_effect';
  actorId: string;       // кто действует
  cardId?: string;       // только для kind:'play'
  // Для await_choice:
  chooserId?: string;    // кто выбирает
  purpose?: 'hand_limit' | 'archangel_prevent';
  options?: string[];    // варианты выбора
  remaining?: number;    // сколько ещё выбрать
  done?: string[];       // уже выбранные
  expiresAt?: number;    // таймаут (epoch ms)
  // Для prompt:
  prompts?: TurnStartPrompt[];
  // Для turn_start_effect / trigger_effect:
  sourceCardId?: string;
  effectIdx?: number;
  uncounterable?: boolean;
  // Для play:
  redirects?: { toTargetId?: string };
  intercept?: { receiverPlayerId?: string };
  cancelLevel?: number;
  hypnorog?: { cancel?: boolean; by?: string; discardCardId?: string };
};
```

### OptionalSkipRecord

```typescript
interface OptionalSkipRecord {
  cardId: string;
  kind: string;
  targetPlayer: string;
  playerId: string;
  quantity: number;
  t: number;
}
```

### LogEntry

```typescript
type LogEntry = {
  t: number;
  type: 'draw' | 'play' | 'end' | 'react' | 'discard' | 'turn_start_effect' | 'trigger_effect' | 'debug';
  playerId?: string;
  details?: any;
};
```

---

## 4. Правила валидации контракта

1. Фронтенд **читает** `state.cards[cardId]`, а не ищет по `name`
2. `canReact` вычисляется на сервере (server/src/data/canReactFlags.ts), клиент не дублирует
3. При `extra.needTargets === true` — клиент открывает окно выбора целей
4. При `extra.noSwapCandidates === true` — показывать «Невозможно совершить обмен» и не слать /playWithTargets
5. `state.turn.skippedPhases` — клиент пропускает соответствующие фазы в UI
6. REST-ошибки **не содержат** поля `code` — только `message` и поля extra в корне
7. Успешные ответы REST: голый GameState, **без обёртки** `{ success, extra }`
8. `needTargetPlayer`/`kind`/`options.players` лежат в **корне** тела 409, не в `extra`

---

## 5. Ошибки (Error Codes)

### 5.1 REST — коды HTTP и ответы

| HTTP | Условие | Поля в теле |
|------|---------|-------------|
| 400 | Большинство ошибок (WRONG_PHASE, CARD_NOT_IN_HAND, NOT_YOUR_TURN, NO_ACTION_POINTS, BAD_REQUEST) | `{ message }` |
| 409 | Требуется цель (downgrade без targetPlayerId, destroy/steal без targets, swap без кандидатов) | `{ message, needTargets?, needTargetPlayer?, kind?, options?, noSwapCandidates? }` |
| 409 | Игра окончена (gameOverGate + playCard/endTurn/drawCard) | `{ message, gameOver, winnerId }` |
| 404 | Игра или сущность не найдена | `{ message }` |

### 5.2 Socket — коды ошибок (только в SocketAck)

Полный список заморожен в `handlers.ts`:

```typescript
type SocketErrorCode =
  | 'GAME_NOT_FOUND'
  | 'BAD_REQUEST'
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_IN_HAND'
  | 'NO_ACTION_POINTS'
  | 'WRONG_PHASE'
  | 'PENDING_ACTION';
```

---

## 6. Примеры ответов

### Пример A: pending_update (Socket → Клиент)

```json
{
  "gameId": "abc123",
  "pending": {
    "kind": "await_choice",
    "actorId": "p1",
    "chooserId": "p2",
    "purpose": "hand_limit",
    "options": ["card_001", "card_002", "card_003"],
    "remaining": 1,
    "done": [],
    "expiresAt": 1731234567890
  },
  "playerId": "p2"
}
```

### Пример B: REST 409 с needTargets (downgrade без цели)

```json
// HTTP 409
{
  "message": "Target player required for downgrade",
  "needTargetPlayer": true,
  "kind": "downgrade",
  "options": {
    "players": ["p1", "p2", "p3"]
  }
}
```

### Пример C: Socket ack join_game — успешный вход

```json
{
  "ok": true,
  "state": {
    "players": [
      {
        "id": "p1",
        "hand": ["card_001", "card_002"],
        "stable": ["card_010"],
        "discard": [],
        "field": [],
        "nursery": [],
        "action_points": 1
      }
    ],
    "deck": ["card_020", "card_021"],
    "discard": [],
    "nursery": ["c_baby_1"],
    "turn": {
      "currentPlayerId": "p1",
      "phase": "begin_turn",
      "has_drawn": false
    },
    "winnerId": null,
    "cards": { ... }
  },
  "pending": null,
  "logs": []
}
```

### Пример D: REST /play успех — голый GameState

```json
// HTTP 200, Content-Type: application/json
{
  "players": [...],
  "turn": { "currentPlayerId": "p2", "phase": "action", "has_drawn": true },
  "cards": { ... },
  "deck": [...],
  "discard": ["card_001_discarded"],
  "winnerId": null,
  ...
}
```

### Пример E: REST /play успех с окном реакции

```json
// HTTP 200
{
  "pending": {
    "kind": "play",
    "actorId": "p1",
    "cardId": "card_007",
    "expiresAt": 1731234567890
  },
  "state": { ... }
}
```

---

## 7. Расхождения, исправленные 11.11.2026

| # | Что было в старой версии | Что на самом деле | Статус |
|---|---|---|---|
| D-1 | `/play` возвращает `{ success, extra: { state } }` | Голый `GameState` (или `{ pending, state }`) | Исправлено в документе |
| D-3 | `needTargets`/`kind`/`options` внутри `extra` | В **корне** тела ошибки | Исправлено в документе |
| D-5 | `PendingAction` = `type/playerId/timeout` | `kind/actorId/chooserId/expiresAt` | Исправлено в документе |
| D-6 | 12 кодов ошибок | 7 socket-кодов + HTTP-коды REST | Исправлено в документе |
| D-7 | `turn.current`, поля `id/logs/gameOver` | `turn.currentPlayerId`, `logs` отдельно, без `gameOver` в GameState | Исправлено в документе |
| D-2 | `code` описан в REST-ошибках | Поля `code` в REST **нет** | **Ждёт D-2 от Бэкенда** |
| D-4 | Код `GAME_OVER` существует | Конец партии = `WRONG_PHASE` + `gameOver:true` | **Ждёт D-4 (решение Даниила принято: не менять)** |

---

## 8. История изменений

| Дата | Что изменено |
|------|-------------|
| 11.11.2026 | Полная переработка под фактическое поведение кода (решение Даниила). |
| 11.11.2026 | Убраны `success`/`extra`-обёртки, поле `code` из REST, 12→7 кодов. |
| 11.11.2026 | `PendingAction` переписан под реальные поля (`kind/actorId/chooserId`). |
| 11.11.2026 | `GameState.turn` — `currentPlayerId`, `phase`, `has_drawn`. |
| 11.11.2026 | Добавлен раздел «Расхождения» (D-1…D-7). |
