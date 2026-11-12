# ARCHITECTURE.md — Архитектура проекта

> Стек: TypeScript, React 18 + MUI, Node.js 22, Socket.io 4, MongoDB 8.0 (локально).
> Движок: полный (routes/game.ts) + упрощённый (gameInstance.ts для ботов).
> CI: Jest + tsc.

---

## 1. Структура папок

```
unstable-unicorns-online-new/
├── server/                      # Бэкенд (Node.js + Express + Socket.io)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── game.ts         # [1088 строк] Движок: play, endTurn, реакции (Neigh, Super Neigh…), REST-маршруты
│   │   │   ├── gameStore.ts    # Map<string, GameSession> — хранилище партий (Аналитик)
│   │   │   └── unicorns.ts     # /api/cards — CRUD карт
│   │   ├── engine/
│   │   │   ├── executor.ts     # Резолвер эффектов (resolveEffect, executeAction, ~1800 строк)
│   │   │   ├── state.ts        # GameState, PlayerState, getZoneArray
│   │   │   ├── stateView.ts    # Фиксатор состояния для клиента
│   │   │   ├── events.ts       # EventBus
│   │   │   ├── leader.ts       # maybeEndOnDeckEmpty, hasEnoughUnicorns
│   │   │   ├── unicornTypes.ts # cardSubtypeTags, isUnicornCard, isNurseryOnly, isMaskedUnicorn
│   │   │   ├── handLimit.ts    # handLimitFor (модификаторы лимита руки)
│   │   │   └── canReactFlags.ts# Флаги реакций (Neigh, Super Neigh, Elusive Oceloticorn…)
│   │   ├── game/
│   │   │   ├── gameInstance.ts # Упрощённый движок (счётчики единорогов, join_room, боты, 14 сьютов)
│   │   │   ├── gameService.ts  # Прослойка: turnStart, playCard, endTurn, можетEndGame
│   │   │   └── config.ts       # getWinningScore, HAND_LIMIT_BASE
│   │   ├── models/
│   │   │   └── Card.ts         # Mongoose схема
│   │   ├── socket/
│   │   │   └── handlers.ts     # Socket.io обработчики (play_card, draw_card, end_turn, реакции)
│   │   ├── data/
│   │   │   ├── unicorns.json   # Импортированные данные (565 карт, старая фикстура)
│   │   │   └── canReactFlags.ts
│   │   └── helpers/
│   │       └── api.ts          # Тестовые хелперы (createGame, playCard, endTurn…)
│   ├── test/
│   │   ├── socket.test.ts      # Socket.io тесты
│   │   ├── playContract.test.ts
│   │   ├── reactions.test.ts
│   │   ├── drawContract.test.ts
│   │   ├── nurseryDeal.test.ts
│   │   ├── b1SkipPhases.test.ts
│   │   ├── canReactFlagsNameEn.test.ts
│   │   ├── excludeSelf.test.ts
│   │   ├── enterHook.test.ts
│   │   ├── subtypeFilters.test.ts
│   │   ├── swapTransport.test.ts
│   │   └── helpers/            # api.ts, cards.ts (фикстуры карт), etc.
│   ├── data/
│   │   └── catalog.v2.json     # 329 карт, источник правды (Аналитик)
│   ├── dist/                   # tsc output
│   └── package.json
├── client/                      # Фронтенд (React + MUI)
│   ├── src/
│   │   ├── components/         # UI компоненты
│   │   ├── theme/
│   │   │   ├── tokens.ts       # Тема (rainbow / dark)
│   │   │   └── fonts/          # Cormorant Garamond
│   │   ├── store/              # Redux Toolkit
│   │   └── redux/              # Слайсы (game, cards, ui)
│   ├── public/
│   └── package.json
├── docs/                        # Документация (читают все агенты)
│   ├── PROJECT_MAP.md
│   ├── MEMORY.md
│   ├── API_CONTRACT.md
│   ├── ARCHITECTURE.md
│   ├── GAME_RULES.md
│   ├── effect-vocabulary.md
│   ├── tz-effect-vocabulary.md
│   └── acceptance-*.md
├── _ac_check.js               # Скрипт проверки гейта
├── _an_b5_*                   # Временные файлы Аналитика
└── _te_*                      # Временные файлы Тестировщика
```

---

## 2. Потоки данных

```
Клиент (React)
  │
  ├── REST POST /api/game/:id/play
  ├── REST POST /api/game/:id/endTurn
  ├── REST POST /api/game/:id/react/:reaction
  └── Socket.io (join_game, play_card, draw_card, end_turn)
        │
        ▼
  server/src/routes/game.ts   ← основной движок
        │
        ├── gameStore.ts (Map games)  ← хранение партий
        ├── engine/executor.ts       ← резолвер эффектов
        └── engine/stateView.ts      ← фиксация для клиента
        │
        ▼
  state_update (broadcast всем игрокам)
```

---

## 3. Два движка (решение Даниила 28.10.2026)

| Движок | Файл | Назначение |
|--------|------|------------|
| Полный | `routes/game.ts` + `gameStore.ts` | Основной геймплей (все карты, все эффекты, реакции) |
| Упрощённый | `gameInstance.ts` | Боты, симуляции, 14 тестов (счётчики единорогов) |

План: перевести socket + /lobby + /room на gameStore, /playtest оставить отладочной.

---

## 4. База данных

- **MongoDB 8.0.14** на `127.0.0.1:27017` (локально)
- **Atlas Cluster0** — на паузе (пароль требует смены — висячий коммит 92e0fbb)
- База: `uu_new`, коллекция `cards` (328 карт)
- Mongoose схема: `server/src/models/Card.ts`
- В тестах: `NODE_ENV=test`, Mongo не требуется

---

## 5. Тестирование

- **Jest** — `node node_modules/jest/bin/jest.js` из папки server
- **tsc** — проверка типов
- Базовая линия (07.11.2026): 53 сьюта, 495 тестов, 491 pass, 4 skip
- Правило: RED-тест сначала (мутация → красный), потом реализация → зелёный
- Хелперы: `test/helpers/api.ts` (createGame, playCard, endTurn), `test/helpers/cards.ts` (фикстуры)

---

## 6. Локальный запуск

```bash
# Бэкенд
cd server
node_modules/.bin/tsc
node dist/server/src/routes/game.ts  # порт 3001

# Фронтенд
cd client
npx vite --force --host  # [::1]:5173
```

---

## 7. Принципы

1. **Один писатель на файл** — строго по ролям
2. **Данные → Движок** — сначала каталог, потом код
3. **Никаких сравнений по имени карты** — все эффекты через параметры
4. **RED → GREEN** — любые изменения через тесты
5. **STATUS каждые ~14 команд** — лимит шагов платформы
6. **Мост — один агент за раз** — остальные ждут