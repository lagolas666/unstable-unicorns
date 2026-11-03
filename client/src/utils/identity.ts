/**
 * Локальная идентификация игрока.
 * Сервер знает только playerId, никнеймы живут на клиенте, поэтому храним их рядом.
 */

const UID_KEY = 'uu:playerId';
const NICKNAME_KEY = 'uu:nickname';
const NICKNAMES_KEY = 'uu:nicknames';

function randomId(): string {
  return `p_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

/** Стабильный id игрока в localStorage. */
export function getPlayerId(): string {
  const stored = localStorage.getItem(UID_KEY);
  if (stored) return stored;
  const id = randomId();
  localStorage.setItem(UID_KEY, id);
  return id;
}

/** Свой никнейм. По умолчанию «Игрок». */
export function getNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) || 'Игрок';
}

export function setNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_KEY, nickname);
}

function readNicknames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NICKNAMES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Запомнить никнейм игрока по id — чтобы другие экраны показывали имя, а не id. */
export function rememberNickname(playerId: string, nickname: string): void {
  const all = readNicknames();
  all[playerId] = nickname;
  localStorage.setItem(NICKNAMES_KEY, JSON.stringify(all));
}

/** Все известные клиенту подписи игроков. */
export function getKnownNicknames(): Record<string, string> {
  return readNicknames();
}
