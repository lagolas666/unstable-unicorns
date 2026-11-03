import type { Player, Phase } from './types';

/**
 * Состояние игры для отправки клиенту.
 * Чистая функция: принимает внутренние поля, возвращает view без мутаций.
 */
export interface GameStateView {
  roomId: string;
  phase: Phase;
  players: Array<{ id: string; nickname: string; unicorns: number; isHost: boolean }>;
  currentTurn?: string;
  winner?: string;
}

/**
 * Построить состояние игры для клиента.
 *
 * Чистая функция: не мутирует вход, не обращается к `this`, только формирует
 * объект для отправки через socket. Раньше это был метод `getState()` в
 * `GameInstance`, теперь вынесен для тестируемости и переиспользования.
 *
 * @param roomId идентификатор комнаты
 * @param phase текущая фаза хода
 * @param players карта игроков (внутреннее состояние)
 * @param currentTurnIndex индекс текущего игрока
 * @param winner ник победителя, если игра окончена
 */
export function buildStateView(
  roomId: string,
  phase: Phase,
  players: Map<string, Player>,
  currentTurnIndex: number,
  winner?: string
): GameStateView {
  const playersArr = Array.from(players.values());
  const playersView = playersArr.map(p => ({
    id: p.id,
    nickname: p.nickname,
    unicorns: p.unicorns,
    isHost: p.isHost,
  }));
  const currentTurn = playersArr[currentTurnIndex % Math.max(1, playersArr.length)]?.nickname;
  return {
    roomId,
    phase,
    players: playersView,
    currentTurn,
    winner,
  };
}
