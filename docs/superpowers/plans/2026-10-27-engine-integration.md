# Engine ↔ GameInstance Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make socket layer (index.ts) and REST layer (routes/game.ts) share one game engine, replacing the toy `gameInstance.ts` (unicorns += 1) with a real engine-backed session.

**Architecture:** Extract the in-memory game Map from `routes/game.ts` into a shared `gameStore.ts`. Rewrite `gameInstance.ts` as a class wrapping `GameState` + `EventBus` + pending-reaction logic (reused from routes/game.ts). Sockets in `index.ts` call `gameStore.get(gameId).method()`. REST routes in `routes/game.ts` call the same store.

**Tech Stack:** TypeScript, Express, Socket.IO, Jest, existing engine/executor.ts

**Spec:** `D:\CascadeProjects\unstable-unicorns-online-new\server\src\routes\game.ts` (2640 lines, full engine logic), `server\src\game\gameInstance.ts` (toy), `server\src\engine\` (state, executor, events)

## Global Constraints

- 2–6 players (official rules); 7 unicorns to win for ≤5 players, 6 for 6+ players
- All card effects resolved via `engine/executor.ts` (resolveEffect, resolveActions, triggerTurnStartEffects)
- Reaction windows (Neigh/Nope/Hypnorog) use 10–15s timer with pending queue
- Nursery pile for Baby Unicorns; 3 cards = 1 Baby purchase
- No breaking changes to REST API contract (routes/game.ts endpoints stay the same)

## Review Focus

1. **Two stores diverge:** gameStore and routes/game.ts Map must be the SAME object, not two copies
2. **Socket events vs REST endpoints:** both must produce identical state transitions
3. **Pending reaction cleanup:** timeouts must clear on game destroy and disconnect
4. **Test isolation:** each test must get a fresh gameStore entry, no cross-test leaks
5. **Backward compat:** existing REST tests (reactions.test.ts etc.) must pass without changes

---

### Task 1: Fix test imports (gameInstance.test.ts, bot.test.ts)

**Files:**
- Modify: `server/test/gameInstance.test.ts:1`
- Modify: `server/test/bot.test.ts:1`

**Interfaces:**
- Consumes: `server/src/game/gameInstance.ts` (current toy)
- Produces: passing tests for current toy (baseline before rewrite)

- [ ] **Step 1: Read current import lines**

Run: `head -1 server/test/gameInstance.test.ts server/test/bot.test.ts`
Expected: both show `import ... from '../game/gameInstance'`

- [ ] **Step 2: Fix import path in gameInstance.test.ts**

Change line 1 from:
```ts
import GameInstance from '../game/gameInstance';
```
to:
```ts
import GameInstance from '../src/game/gameInstance';
```

- [ ] **Step 3: Fix import path in bot.test.ts**

Change the import line similarly to `'../src/game/gameInstance'`.

- [ ] **Step 4: Run the two test files**

Run: `cd server && npx jest test/gameInstance.test.ts test/bot.test.ts --no-coverage`
Expected: PASS (2 suites, all tests pass)

- [ ] **Step 5: Commit**

```bash
git add server/test/gameInstance.test.ts server/test/bot.test.ts
git commit -m "fix: correct import paths for gameInstance tests"
```

---

### Task 2: Add config.ts with getWinningScore(playerCount)

**Files:**
- Create: `server/src/game/config.ts`
- Test: `server/test/config.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `getWinningScore(playerCount: number): number` — returns 7 for 2–5 players, 6 for 6–8 players, throws RangeError otherwise

- [ ] **Step 1: Write failing test**

Create `server/test/config.test.ts`:
```ts
import { getWinningScore } from '../src/game/config';

describe('getWinningScore', () => {
  test('returns 7 for 2-5 players', () => {
    expect(getWinningScore(2)).toBe(7);
    expect(getWinningScore(3)).toBe(7);
    expect(getWinningScore(4)).toBe(7);
    expect(getWinningScore(5)).toBe(7);
  });
  test('returns 6 for 6-8 players', () => {
    expect(getWinningScore(6)).toBe(6);
    expect(getWinningScore(7)).toBe(6);
    expect(getWinningScore(8)).toBe(6);
  });
  test('throws for invalid player count', () => {
    expect(() => getWinningScore(1)).toThrow(RangeError);
    expect(() => getWinningScore(0)).toThrow(RangeError);
    expect(() => getWinningScore(9)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest test/config.test.ts --no-coverage`
Expected: FAIL — Cannot find module '../src/game/config'

- [ ] **Step 3: Implement config.ts**

Create `server/src/game/config.ts`:
```ts
export function getWinningScore(playerCount: number): number {
  if (playerCount < 2 || playerCount > 8) {
    throw new RangeError(`playerCount must be 2-8, got ${playerCount}`);
  }
  return playerCount <= 5 ? 7 : 6;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest test/config.test.ts --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/game/config.ts server/test/config.test.ts
git commit -m "feat: add getWinningScore with official rules (7 for ≤5, 6 for 6+)"
```

---

### Task 3: Extract gameStore from routes/game.ts

**Files:**
- Create: `server/src/game/gameStore.ts`
- Modify: `server/src/routes/game.ts` (replace local Map with import)

**Interfaces:**
- Consumes: `engine/state.ts` (GameState), `engine/events.ts` (EventBus)
- Produces: `gameStore.get(gameId)`, `gameStore.create(gameId)`, `gameStore.delete(gameId)`, `gameStore.list()`
- Types exported: `GameSession`, `LogEntry`, `Pending`, `PendingPlay`, `PendingPrompt`, `PendingTurnStartEffect`, `PendingTriggerEffect`

- [ ] **Step 1: Write failing test**

Create `server/test/gameStore.test.ts`:
```ts
import gameStore from '../src/game/gameStore';

describe('gameStore', () => {
  afterEach(() => {
    // Clean up all games
    for (const id of gameStore.list()) gameStore.delete(id);
  });

  test('create and get', () => {
    const session = gameStore.create('g1');
    expect(session).toBeDefined();
    expect(session.state).toBeDefined();
    expect(session.bus).toBeDefined();
    expect(gameStore.get('g1')).toBe(session);
  });

  test('get returns undefined for missing game', () => {
    expect(gameStore.get('missing')).toBeUndefined();
  });

  test('delete removes game', () => {
    gameStore.create('g2');
    gameStore.delete('g2');
    expect(gameStore.get('g2')).toBeUndefined();
  });

  test('list returns all game ids', () => {
    gameStore.create('a');
    gameStore.create('b');
    expect(gameStore.list().sort()).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest test/gameStore.test.ts --no-coverage`
Expected: FAIL — Cannot find module

- [ ] **Step 3: Implement gameStore.ts**

Create `server/src/game/gameStore.ts` with:
- Types `LogEntry`, `PendingPlay`, `PendingPrompt`, `PendingTurnStartEffect`, `PendingTriggerEffect`, `Pending`, `GameSession` — copied from `routes/game.ts` lines 1–45
- `GameSession` interface: `{ state: GameState; bus: EventBus; logs: LogEntry[]; pending: Pending; pendingTimeout?: any }`
- Class `GameStore` with private `Map<string, GameSession>`, methods: `create(gameId): GameSession`, `get(gameId): GameSession | undefined`, `delete(gameId): void`, `list(): string[]`
- Export singleton `new GameStore()`

The `create` method initializes:
```ts
create(gameId: string): GameSession {
  const state: GameState = { players: [], turn: { currentPlayerId: '', phase: 'begin_turn' }, cards: {} };
  const bus = new EventBus();
  const session: GameSession = { state, bus, logs: [], pending: null };
  this.games.set(gameId, session);
  return session;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest test/gameStore.test.ts --no-coverage`
Expected: PASS (4 tests)

- [ ] **Step 5: Replace Map in routes/game.ts with gameStore import**

In `server/src/routes/game.ts`:
1. Add import: `import gameStore from '../game/gameStore';`
2. Remove the local `const games = new Map<string, ...>()` declaration (line ~47)
3. Remove the type declarations for `LogEntry`, `PendingPlay`, etc. (lines 7–45) — they are now in gameStore.ts
4. Replace all `games.get(gameId)` with `gameStore.get(gameId)`
5. Replace all `games.set(gameId, ...)` with `gameStore.create(gameId)` (or keep set if needed)
6. Replace all `games.delete(gameId)` with `gameStore.delete(gameId)`
7. Replace all `games.has(gameId)` with `gameStore.get(gameId) !== undefined`

- [ ] **Step 6: Run ALL existing tests to verify no regression**

Run: `cd server && npx jest --no-coverage 2>&1 | tail -5`
Expected: same pass/fail count as baseline (10 failed, 73 passed) — no NEW failures

- [ ] **Step 7: Commit**

```bash
git add server/src/game/gameStore.ts server/src/routes/game.ts server/test/gameStore.test.ts
git commit -m "refactor: extract gameStore from routes/game.ts into shared module"
```

---

### Task 4: Rewrite gameInstance as engine wrapper

**Files:**
- Modify: `server/src/game/gameInstance.ts` (full rewrite)
- Test: `server/test/gameInstance.test.ts` (rewrite tests)

**Interfaces:**
- Consumes: `gameStore.ts` (GameSession), `engine/executor.ts`, `config.ts` (getWinningScore)
- Produces: `GameInstance` class with methods: `addPlayer`, `removePlayer`, `startGame`, `drawCard`, `playCard`, `playCardWithTargets`, `endTurn`, `reactNeigh`, `reactNope`, `getState`, `getWinningScore`

- [ ] **Step 1: Write failing tests for new GameInstance**

Rewrite `server/test/gameInstance.test.ts`:
```ts
import { GameInstance } from '../src/game/gameInstance';
import gameStore from '../src/game/gameStore';

describe('GameInstance (engine-backed)', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance('test-room');
  });

  afterEach(() => {
    gameStore.delete('test-room');
  });

  test('addPlayer creates session in store', () => {
    game.addPlayer('p1', 'Alice');
    const session = gameStore.get('test-room');
    expect(session).toBeDefined();
    expect(session!.state.players).toHaveLength(1);
    expect(session!.state.players[0].id).toBe('p1');
  });

  test('startGame deals cards and sets phase to draw', () => {
    game.addPlayer('p1', 'Alice');
    game.addPlayer('p2', 'Bob');
    game.startGame();
    const session = gameStore.get('test-room');
    expect(session!.state.players).toHaveLength(2);
    expect(session!.state.players[0].hand.length).toBeGreaterThan(0);
    expect(session!.state.turn.phase).toBe('draw');
  });

  test('getWinningScore returns correct value', () => {
    game.addPlayer('p1', 'Alice');
    game.addPlayer('p2', 'Bob');
    expect(game.getWinningScore()).toBe(7);
  });

  test('getState returns serializable state', () => {
    game.addPlayer('p1', 'Alice');
    const state = game.getState();
    expect(state.roomId).toBe('test-room');
    expect(state.players).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest test/gameInstance.test.ts --no-coverage`
Expected: FAIL — methods don't exist yet

- [ ] **Step 3: Rewrite gameInstance.ts**

Replace the entire file with a new `GameInstance` class that:
1. Constructor takes `roomId: string`
2. `addPlayer(socketId, nickname)` — calls `gameStore.getOrCreate(roomId)` if not exists, then adds a `PlayerState` to `session.state.players`
3. `startGame()` — loads cards from DB (CardModel), shuffles, deals 5 cards to each player, separates Baby Unicorns to nursery, sets `turn.phase = 'draw'`, sets `turn.currentPlayerId` to first player
4. `drawCard(playerId)` — moves 1 card from `player.deck` to `player.hand`, sets `turn.has_drawn = true`
5. `playCard(playerId, cardId)` — moves card from hand to stable/field, resolves effects via executor
6. `endTurn(playerId)` — checks hand limit (7), checks win condition via `getWinningScore()`, advances to next player, resets phase to 'draw'
7. `getState()` — returns serializable snapshot
8. `getWinningScore()` — calls `getWinningScore(state.players.length)` from config.ts

Key implementation notes:
- Reuse card-loading logic from `routes/game.ts` (function `loadCardsFromDB` or similar)
- Reuse shuffle/deal logic from `routes/game.ts`
- Reuse `performPlayNow` from `routes/game.ts` for card resolution
- Reuse `checkWin` from `routes/game.ts`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest test/gameInstance.test.ts --no-coverage`
Expected: PASS (4 tests)

- [ ] **Step 5: Run ALL tests to verify no regression**

Run: `cd server && npx jest --no-coverage 2>&1 | tail -5`
Expected: same or better pass/fail count

- [ ] **Step 6: Commit**

```bash
git add server/src/game/gameInstance.ts server/test/gameInstance.test.ts
git commit -m "refactor: rewrite gameInstance as engine-backed session wrapper"
```

---

### Task 5: Wire sockets to new gameInstance

**Files:**
- Modify: `server/src/index.ts` (socket handlers)

**Interfaces:**
- Consumes: `gameInstance.ts` (GameInstance), `gameStore.ts`
- Produces: socket events `join_room`, `start_game`, `draw_card`, `play_card`, `end_turn`, `react_neigh`, `react_nope` all call `GameInstance` methods

- [ ] **Step 1: Update socket handlers in index.ts**

Replace the socket handlers (lines ~70–110) to use `GameInstance`:

```ts
socket.on('join_room', ({ roomId, nickname }) => {
  socket.join(`game:${roomId}`);
  let game = gameStore.get(roomId);
  if (!game) {
    const instance = new GameInstance(roomId);
    instance.addPlayer(socket.id, nickname || 'Guest');
  } else {
    // GameInstance already exists, add player to it
    const instance = gameInstances.get(roomId);
    instance?.addPlayer(socket.id, nickname || 'Guest');
  }
  const state = gameStore.get(roomId);
  if (state) socket.emit('game_state', state);
});

socket.on('start_game', ({ roomId }) => {
  const instance = gameInstances.get(roomId);
  if (!instance) return;
  instance.startGame();
  io?.to(`game:${roomId}`).emit('game_started', instance.getState());
});

socket.on('draw_card', ({ roomId }) => {
  const instance = gameInstances.get(roomId);
  if (!instance) return;
  instance.drawCard(socket.id);
  io?.to(`game:${roomId}`).emit('game_state', instance.getState());
});

socket.on('play_card', ({ roomId, cardId }) => {
  const instance = gameInstances.get(roomId);
  if (!instance) return;
  instance.playCard(socket.id, cardId);
  io?.to(`game:${roomId}`).emit('game_state', instance.getState());
});

socket.on('end_turn', ({ roomId }) => {
  const instance = gameInstances.get(roomId);
  if (!instance) return;
  instance.endTurn(socket.id);
  io?.to(`game:${roomId}`).emit('game_state', instance.getState());
});
```

Add a module-level `const gameInstances = new Map<string, GameInstance>()` to track instances.

- [ ] **Step 2: Run ALL tests**

Run: `cd server && npx jest --no-coverage 2>&1 | tail -5`
Expected: same or better pass/fail count

- [ ] **Step 3: Manual smoke test**

Start server: `cd server && npm run dev`
Connect via socket client, join room, start game, draw card, play card, end turn.
Verify no crashes, state updates correctly.

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: wire socket layer to engine-backed GameInstance"
```

---

### Task 6: Slim down routes/game.ts to use GameInstance

**Files:**
- Modify: `server/src/routes/game.ts` (replace direct state manipulation with GameInstance calls)

**Interfaces:**
- Consumes: `gameInstance.ts` (GameInstance)
- Produces: REST endpoints call GameInstance methods instead of manipulating GameState directly

- [ ] **Step 1: Identify functions in routes/game.ts that manipulate state directly**

Grep for functions that modify `state.players`, `state.turn`, `state.deck`, etc. These should call `GameInstance` methods instead.

- [ ] **Step 2: Refactor POST /api/game/create**

Replace direct state creation with:
```ts
const instance = new GameInstance(gameId);
instance.addPlayer(req.body.playerId, req.body.nickname);
// ... add other players
gameInstances.set(gameId, instance);
res.json({ gameId });
```

- [ ] **Step 3: Refactor POST /api/game/:id/draw**

Replace with:
```ts
const instance = gameInstances.get(req.params.id);
instance.drawCard(req.body.playerId);
res.json(instance.getState());
```

- [ ] **Step 4: Refactor POST /api/game/:id/play**

Replace with:
```ts
const instance = gameInstances.get(req.params.id);
instance.playCard(req.body.playerId, req.body.cardId);
res.json(instance.getState());
```

- [ ] **Step 5: Refactor POST /api/game/:id/endTurn**

Replace with:
```ts
const instance = gameInstances.get(req.params.id);
instance.endTurn(req.body.playerId);
res.json(instance.getState());
```

- [ ] **Step 6: Keep reaction endpoints (neigh, nope, hypnorog) as-is for now**

These are complex and will be refactored in a separate task. For now, they continue to work with `gameStore.get(gameId)` directly.

- [ ] **Step 7: Run ALL tests**

Run: `cd server && npx jest --no-coverage 2>&1 | tail -5`
Expected: same or better pass/fail count

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/game.ts
git commit -m "refactor: routes/game.ts calls GameInstance methods"
```

---

### Task 7: Fix remaining 10 failing tests

**Files:**
- Modify: `server/test/reactions.test.ts` (and other failing test files)

**Interfaces:**
- Consumes: the refactored code from Tasks 1–6
- Produces: 0 failed tests

- [ ] **Step 1: Run tests and capture failures**

Run: `cd server && npx jest --no-coverage 2>&1 > jest-failures.txt`

- [ ] **Step 2: Analyze failures**

Read `jest-failures.txt` and categorize:
- Import errors → fix imports
- Assertion errors → fix logic in gameInstance or routes
- Timeout errors → fix async handling

- [ ] **Step 3: Fix each failure**

For each failure:
1. Identify root cause (use systematic-debugging skill)
2. Write a minimal test that reproduces the issue
3. Fix the code
4. Verify the test passes
5. Run all tests to ensure no regression

- [ ] **Step 4: Run ALL tests**

Run: `cd server && npx jest --no-coverage`
Expected: 0 failed, all passed

- [ ] **Step 5: Commit**

```bash
git add server/test/ server/src/
git commit -m "fix: resolve all failing tests"
```

---

## Execution Order

1. **Task 1** (5 min) — fix imports, establish baseline
2. **Task 2** (10 min) — add config, independent of other tasks
3. **Task 3** (30 min) — extract gameStore, foundational for Tasks 4–6
4. **Task 4** (60 min) — rewrite gameInstance, core of the integration
5. **Task 5** (30 min) — wire sockets, depends on Task 4
6. **Task 6** (60 min) — refactor routes, depends on Task 4
7. **Task 7** (60 min) — fix remaining failures, depends on all above

Total estimated time: ~4 hours

## Risk Mitigation

- **Task 3 is critical:** if gameStore extraction breaks routes/game.ts, revert and try a different approach (e.g., keep Map in routes but export it)
- **Task 4 is large:** if rewriting gameInstance is too complex, split into sub-tasks (4a: deck/deal, 4b: draw/play, 4c: endTurn/win)
- **Task 6 depends on Task 4:** if routes/game.ts is too coupled, keep it as-is and only refactor the endpoints that sockets use
- **Task 7 may reveal design flaws:** if tests still fail after Tasks 1–6, revisit the architecture (e.g., maybe GameInstance should not wrap GameState, but extend it)
