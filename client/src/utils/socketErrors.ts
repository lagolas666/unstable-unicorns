/**
 * Человекочитаемые тексты для кодов ошибок socket-контракта.
 * Коды заморожены на сервере (SocketErrorCode), тексты — только для UI.
 */
import type { SocketErrorCode } from '../types/socket';

const ERROR_TEXTS: Record<SocketErrorCode, string> = {
  GAME_NOT_FOUND: 'Игра не найдена на сервере — возможно, она перезапущена',
  BAD_REQUEST: 'Некорректный запрос',
  NOT_YOUR_TURN: 'Сейчас не ваш ход',
  CARD_NOT_IN_HAND: 'Этой карты нет в руке',
  NO_ACTION_POINTS: 'Закончились очки действий',
  WRONG_PHASE: 'Действие недоступно в текущей фазе',
  // Код оставлен для совместимости: сервер может вернуть его, пока открыто другое окно
  PENDING_ACTION: 'Сейчас открыто окно реакции: дождитесь его завершения или ответьте в нём',
  // Страховка на случай, если сервер положит в message голый код вместо фразы
  TARGET_REQUIRED: 'Выберите игрока, к чьему стойлу прикрепить карту',
};

/** Текст для кода ошибки; неизвестный код показываем как есть, чтобы не прятать баг. */
export function describeSocketError(code: string | undefined, fallbackMessage?: string): string {
  if (code && code in ERROR_TEXTS) {
    return ERROR_TEXTS[code as SocketErrorCode];
  }
  if (fallbackMessage) return fallbackMessage;
  return 'Неизвестная ошибка сервера';
}

/** Код PENDING_ACTION — отдельный признак для UI, а не текст ошибки. */
export function isPendingActionUnavailable(code: string | undefined): boolean {
  return code === 'PENDING_ACTION';
}
