/**
 * Общие типы игрового домена.
 *
 * Вынесены из `gameInstance.ts` (задача 3a), чтобы типы не тянули за собой
 * реализацию класса и могли переиспользоваться движком и сокет-слоем.
 */

/** Игрок в комнате: реальный или бот. */
export type Player = {
  id: string; // socket.id or internal id
  nickname: string;
  unicorns: number;
  socketId: string;
  isHost: boolean;
  isBot?: boolean;
  botDifficulty?: 'easy' | 'normal' | 'hard';
};

/**
 * Фаза игры.
 *
 * ВАЖНО: union не сокращать. `phases` в GameInstance содержит
 * ['start','draw','play','instant','discard','end'], а 'waiting'
 * и 'finished' — краевые состояния жизненного цикла комнаты.
 */
export type Phase =
  | 'waiting'
  | 'start'
  | 'draw'
  | 'play'
  | 'instant'
  | 'discard'
  | 'end'
  | 'finished';

/** Один шаг симуляции таймлайна (используется роутом /sim и реплеем). */
export interface TimelineStep {
  turn: number;
  player: string;
  unicorns: number;
  phase: string;
  action?: string;
}
