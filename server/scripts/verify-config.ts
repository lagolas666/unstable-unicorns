/**
 * Проверка getWinningScore из src/game/config.ts.
 * Временный скрипт для снятия доказательств, не входит в сборку.
 */
import { getWinningScore } from '../src/game/config';

const expected: Array<[number, number]> = [
  [2, 7],
  [3, 7],
  [4, 7],
  [5, 7],
  [6, 6],
  [7, 6],
  [8, 6],
];

let failed = 0;
for (const [players, want] of expected) {
  const got = getWinningScore(players);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} players=${players} want=${want} got=${got}`);
}

const bad: number[] = [0, 1, 9, -1, 3.5, Number.NaN];
for (const p of bad) {
  try {
    getWinningScore(p);
    failed++;
    console.log(`FAIL players=${p} expected throw, got value`);
  } catch (e) {
    console.log(`PASS players=${p} threw ${(e as Error).constructor.name}`);
  }
}

console.log(failed === 0 ? 'RESULT=ALL_OK' : `RESULT=FAILED:${failed}`);
process.exit(failed === 0 ? 0 : 1);
