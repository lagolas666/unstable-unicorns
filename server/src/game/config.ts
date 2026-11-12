/**
 * Конфигурация игровых правил.
 *
 * Единственное место, где задан порог победы. Раньше число 7 было
 * захардкожено в четырёх местах `gameInstance.ts`, из-за чего правило
 * "6 единорогов при 6–8 игроках" не работало вообще.
 */

/** Порог победы для партии на 2–5 игроков. */
export const WINNING_SCORE_SMALL_GAME = 7;

/** Порог победы для партии на 6–8 игроков. */
export const WINNING_SCORE_LARGE_GAME = 6;

/**
 * Лимит руки на конец хода (правило игры).
 *
 * Раньше число 7 было захардкожено в gameService.ts (HAND_LIMIT_BASE) и в движке
 * не использовалось вовсе: эффект draw_until_limit не знал, до чего добирать.
 * Теперь цифра живёт здесь, а сервисный слой и движок читают её отсюда.
 */
export const HAND_LIMIT_BASE = 7;

/** Минимальное и максимальное число игроков, поддерживаемое движком. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

/**
 * Возвращает количество единорогов, необходимое для победы.
 *
 * Правила Unstable Unicorns:
 *  - 2–5 игроков  → 7 единорогов;
 *  - 6–8 игроков  → 6 единорогов.
 *
 * Порог считается динамически от числа игроков, хардкодить его в игровой
 * логике нельзя: сервер — единственный источник истины, и порог должен
 * пересчитываться при изменении состава партии.
 *
 * @param playerCount число игроков в партии
 * @throws RangeError если число игроков не целое или вне диапазона 2–8
 */
export function getWinningScore(playerCount: number): number {
  if (!Number.isInteger(playerCount)) {
    throw new RangeError(
      `getWinningScore: число игроков должно быть целым, получено ${playerCount}`
    );
  }
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new RangeError(
      `getWinningScore: число игроков должно быть в диапазоне ${MIN_PLAYERS}–${MAX_PLAYERS}, получено ${playerCount}`
    );
  }
  return playerCount <= 5 ? WINNING_SCORE_SMALL_GAME : WINNING_SCORE_LARGE_GAME;
}
