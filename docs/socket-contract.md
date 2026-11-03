# Socket-контракт (задача 6b, требование 3)

Автор: Единорог Тестировщик. Версия 1 от 28.10.2026.
Тест-эталон: `server/test/socket.test.ts`. Документ и тест — одно ТЗ, расходятся только вместе.

## Зачем

Сейчас полноценный движок доступен только по REST (`/api/game/*`), а socket-слой
в `src/index.ts` работает на игрушечном `gameInstance` (`join_room` / `start_game` /
`end_turn`, только счётчики единорогов, розыгрыша карт нет).

Требование 3: розыгрыш карты должен работать через socket **на том же хранилище**,
что и REST. Два разных `Map` = два разных мира: карта, разыгранная в socket,
не видна в REST, и наоборот. Тест ловит именно это.

## Модуль

Новый файл: `server/src/socket/handlers.ts`

```ts
export function registerSocketHandlers(io: SocketIOServer): void;
```

- Регистрирует `io.on('connection', socket => { ... })` — все события ниже внутри.
- Обязан вызываться из `startServer()` в `src/index.ts` вместо инлайновых `socket.on`,
  которые лежат там сейчас.
- Состояние берётся **только** из `../gameStore` (`getGame`, `hasGame`, `games`).
  Своего `Map` модуль не заводит.

## Общий конверт ответа (ack)

Каждый handler принимает payload и **второй аргумент** `ack: (res: SocketAck) => void`:

```ts
type SocketAck =
  | { ok: true; state: GameState; pending?: any; logs?: LogEntry[] }
  | { ok: false; code: SocketErrorCode; message: string };

type SocketErrorCode =
  | 'GAME_NOT_FOUND'
  | 'BAD_REQUEST'
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_IN_HAND'
  | 'NO_ACTION_POINTS'
  | 'WRONG_PHASE'
  | 'PENDING_ACTION';
```

Правила:
- Handler **никогда не бросает** исключение наружу: любая ошибка → `ok:false` с `code`.
- `state` в успешном ack — то состояние, которое уже лежит в сторе (не копия «на будущее»).
- Ошибки валидации движка мапятся в коды, а не отдаются текстом как есть.

## События

| Событие | Payload | Успех | Ошибки |
|---|---|---|---|
| `join_game` | `{ gameId: string, playerId?: string }` | `ok:true` + `state`, socket в комнате `game:<gameId>` | `GAME_NOT_FOUND` |
| `leave_game` | `{ gameId: string }` | `ok:true` | — |
| `play_card` | `{ gameId, playerId, cardId, targets?: string[], targetPlayerId?: string }` | `ok:true` + `state` | `GAME_NOT_FOUND`, `CARD_NOT_IN_HAND`, `NO_ACTION_POINTS`, `WRONG_PHASE`, `PENDING_ACTION`, `BAD_REQUEST` |
| `draw_card` | `{ gameId, playerId }` | `ok:true` + `state` | `GAME_NOT_FOUND`, `WRONG_PHASE` |
| `end_turn` | `{ gameId, playerId }` | `ok:true` + `state` (ход у следующего) | `GAME_NOT_FOUND`, `NOT_YOUR_TURN`, `BAD_REQUEST` |
| `resolve_pending` | `{ gameId, playerId }` — `playerId` **обязателен** | `ok:true` + `state` | `GAME_NOT_FOUND`, `BAD_REQUEST` (`playerId is required`, `Not your reaction window`, `Nothing pending`) |
| `react` | `{ gameId, playerId, kind: 'neigh'\|'super_neigh'\|'redirect'\|'shield'\|'rewind'\|'hypnorog'\|'prevent'\|'ignore_target', instantCardId?, targetId?, discardCardId? }` | `ok:true` + `state` | `GAME_NOT_FOUND`, `BAD_REQUEST` |

Окно реакции (`resolve_pending`) закрывает только его актор: `playerId` сверяется с
`pending.actorId`, чужой игрок получает `BAD_REQUEST` с текстом `Not your reaction window`,
состояние и окно при этом не меняются. REST-маршрут `POST /api/game/:id/resolvePending`
проверку не выполняет — он анонимный (остаётся для автотестов и серверных сценариев),
поэтому игровой UI обязан ходить через socket.

`play_card`, `end_turn`, `react`, `resolve_pending` при успехе **дополнительно**
broadcast'ят в комнату `game:<gameId>`: `state_update` (state) и `logs_update` (журнал,
последние 100 записей) — те же имена, что уже использует REST-роутер.

## Что проверяет тест `server/test/socket.test.ts`

Транспорт не поднимается: берётся фейковый `io` + фейковый `socket`, вызывается
`registerSocketHandlers(io)`, событие дергается напрямую с ack. Тяжёлый
`socket.io-client` в зависимости не тянем.

- S01 `registerSocketHandlers` регистрирует обработчик `connection`.
- S02 `join_game` для игры, созданной **по REST**, отвечает `ok:true` и кладёт socket в комнату `game:<id>` — доказательство общего стора.
- S03 `join_game` для несуществующей игры → `ok:false`, `GAME_NOT_FOUND`, без исключения.
- S04 `play_card` кладёт карту из руки в stable; **после этого `GET /api/game/:id` её видит** — требование 3.
- S05 `play_card` для несуществующей игры → `GAME_NOT_FOUND`.
- S06 `play_card` картой, которой нет в руке → `CARD_NOT_IN_HAND`.
- S07 `end_turn` передаёт ход следующему игроку, REST это подтверждает.
- S08 успешный `play_card` broadcast'ит `state_update` в комнату `game:<id>`.
- S09 на неуспешном сценарии broadcast "успеха" не уходит.

## Definition of Done по требованию 3

1. `npm test` — сьют `socket.test.ts` зелёный, остальные 15 сьютов не сломаны.
2. `npm run build` / `tsc --noEmit` — новых ошибок не добавилось (базовые 5 остаются).
3. `src/index.ts` больше не содержит собственной логики `join_room`/`start_game`/`end_turn`
   поверх `gameInstance`, а вызывает `registerSocketHandlers(io)`.
