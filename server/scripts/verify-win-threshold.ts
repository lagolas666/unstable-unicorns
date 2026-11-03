/**
 * Проверка: GameInstance реально использует getWinningScore.
 *
 * Скрипт играет партию без ботов (только endTurn) и смотрит, при каком
 * количестве единорогов объявлен победитель. До подключения config.ts
 * порог был захардкожен (>= 7), поэтому для 6–8 игроков проверка падала.
 *
 * Запуск: npx ts-node scripts/verify-win-threshold.ts
 * Вывод намеренно в ASCII, чтобы не зависеть от кодировки консоли Windows.
 */

import GameInstance from '../src/game/gameInstance';
import { getWinningScore } from '../src/game/config';

/** Проигрывает партию до победы и возвращает счёт победителя. */
function playUntilWin(playerCount: number): number {
  const g = new GameInstance(`verify-${playerCount}`);
  for (let i = 0; i < playerCount; i++) {
    g.addPlayer(`p${i + 1}`, `Player${i + 1}`);
  }
  g.start();
  for (let turn = 0; turn < 5000 && !g.winner; turn++) {
    g.endTurn();
  }
  const state = g.getState();
  const winner = state.players.find((p) => p.nickname === g.winner);
  return winner ? winner.unicorns : -1;
}

let failures = 0;

function check(playerCount: number): void {
  const expected = getWinningScore(playerCount);
  const actual = playUntilWin(playerCount);
  if (actual === expected) {
    console.log(`PASS players=${playerCount} expected=${expected} actual=${actual}`);
  } else {
    failures++;
    console.log(`FAIL players=${playerCount} expected=${expected} actual=${actual}`);
  }
}

// Все допустимые составы: 2–5 -> 7, 6–8 -> 6.
for (let players = 2; players <= 8; players++) {
  check(players);
}

if (failures === 0) {
  console.log('RESULT=ALL_OK');
  process.exit(0);
} else {
  console.log(`RESULT=FAILURES count=${failures}`);
  process.exit(1);
}
