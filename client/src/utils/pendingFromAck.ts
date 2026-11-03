import type { PendingInfo } from '../types/socket';

/**
 * Что делать с окном реакции по ответу сервера в ack.
 *
 * Сервер кладёт `pending` в ack по-разному:
 *  - `join_game` и `ackFromOutcome` (react/resolve_pending) — всегда, включая явный `null`;
 *  - `play_card` — только если движок вернул поле;
 *  - `draw_card` / `end_turn` — не кладут вовсе.
 *
 * Поэтому три состояния различаются:
 *  - `undefined` — сервер ничего не сообщал, текущее окно не трогаем;
 *    иначе добор карты закрывал бы чужую открытую реакцию;
 *  - `null` — окно закрыто, модалку обязательно снимаем;
 *    иначе после перезагрузки в игре без реакций остаётся висеть старая;
 *  - объект — новое окно, заменяем.
 */
export function nextPending(
  current: PendingInfo | null,
  fromAck: PendingInfo | null | undefined
): PendingInfo | null {
  if (fromAck === undefined) return current;
  return fromAck;
}

/**
 * Есть ли у окна живой запас по времени.
 * `expiresAt` — epoch-миллисекунды (сервер: Date.now() + окно).
 * Нужен, чтобы после входа в игру не показывать уже истёкшую реакцию:
 * ack может прийти с окном, которое закрылось, пока шло переподключение.
 */
export function isPendingAlive(pending: PendingInfo | null, now: number = Date.now()): boolean {
  if (!pending) return false;
  if (typeof pending.expiresAt !== 'number') return true;
  return pending.expiresAt > now;
}
