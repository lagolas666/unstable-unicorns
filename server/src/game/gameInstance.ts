import { Server as SocketIOServer } from 'socket.io';
import { getWinningScore, MIN_PLAYERS, MAX_PLAYERS } from './config';

import type { Player, Phase, TimelineStep } from './types';
import { botMoveValue, nextPlayerIndex, nextPhaseOf } from './rules';
import { buildStateView } from './stateView';

// Реэкспорт для обратной совместимости: сюда могут ходить за типами извне.
export type { Player, Phase, TimelineStep };

export class GameInstance {
  roomId: string;
  io?: SocketIOServer;
  players: Map<string, Player> = new Map();
  maxPlayers: number;
  phase: Phase = 'waiting';
  phaseIndex: number = 0; // index in phases array
  currentTurnIndex: number = 0;
  private started: boolean = false;
  winner?: string;
  private phases: Phase[] = ['start','draw','play','instant','discard','end'];

  constructor(roomId: string, io?: SocketIOServer, maxPlayers: number = 8) {
    this.roomId = roomId;
    this.io = io;
    this.maxPlayers = maxPlayers;
  }

  /**
   * Порог победы для заданного состава партии.
   *
   * Считается через getWinningScore (config.ts): 2–5 игроков → 7 единорогов,
   * 6–8 → 6. Раньше здесь стоял хардкод `>= 7` в четырёх местах, поэтому
   * правило для больших партий не работало вообще.
   *
   * После отключений в комнате может остаться состав вне диапазона 2–8.
   * Сервер не должен падать с RangeError, поэтому состав зажимается до
   * ближайшего допустимого, а факт зажима пишется в лог.
   *
   * @param playerCount состав, для которого считаем; по умолчанию — текущий
   */
  private winScore(playerCount: number = this.players.size): number {
    if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
      const clamped = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, playerCount));
      console.warn(
        `[GameInstance ${this.roomId}] состав ${playerCount} вне ${MIN_PLAYERS}–${MAX_PLAYERS}, порог победы считаем для ${clamped}`
      );
      return getWinningScore(clamped);
    }
    return getWinningScore(playerCount);
  }

  addPlayer(socketId: string, nickname: string): void {
    if (this.players.has(socketId)) return;
    const isHost = this.players.size === 0;
    this.players.set(socketId, {
      id: socketId,
      nickname,
      unicorns: 0,
      socketId,
      isHost,
      // Bot detection: nicknames starting with 'AI-' denote bots
      isBot: nickname.startsWith('AI-') ? true : undefined,
      botDifficulty: nickname.startsWith('AI-') ? 'easy' : undefined,
    });
    // If this is a bot, do not count into user flow for real players in UI here
  }

  addBotToRoom(nickname: string, difficulty: 'easy'|'normal'|'hard' = 'easy') {
    const botId = `bot_${nickname}_${Date.now()}`;
    const bot: Player = {
      id: botId,
      nickname,
      unicorns: 0,
      socketId: botId,
      isHost: false,
      isBot: true,
      botDifficulty: difficulty,
    };
    this.players.set(botId, bot);
    // If no host yet and bot is first, set as host (not strictly required, but helps control)
    if (!Array.from(this.players.values()).some(p => p.isHost)) {
      bot.isHost = true;
    }
    // Notify clients about the updated game state
    this.emitState();
  }

  removePlayer(socketId: string): void {
    this.players.delete(socketId);
    // reassign host if needed
    if (this.players.size > 0) {
      const first = this.players.values().next().value as Player;
      if (first) first.isHost = true;
    }
  }

  start(): void {
    if (this.phase !== 'waiting' && this.phase !== 'start') return;
    this.started = true;
    this.phase = 'start';
    this.phaseIndex = 0;
    this.currentTurnIndex = 0;
    // Move to the first actionable phase (draw) immediately
    this.emitState();
    this.nextPhase();
  }

  endTurn(): void {
    if (this.phase === 'finished') return;
    const playersArr = Array.from(this.players.values());
    if (playersArr.length === 0) return;
    const current = playersArr[this.currentTurnIndex % playersArr.length];
    if (current) current.unicorns += 1; // simplistic progress mechanic
    if (current && current.unicorns >= this.winScore(playersArr.length)) {
      this.winner = current.nickname;
      this.phase = 'end';
      this.emitState();
      // End of game, no further phases
      this.phase = 'finished';
      this.emitState();
      return;
    }
    // move to next turn
    this.currentTurnIndex = nextPlayerIndex(this.currentTurnIndex, playersArr.length);
    // progress to next phase (start of new turn)
    this.nextPhase();
    // Bot handling: if next is a bot, schedule its turn
    const next = playersArr[this.currentTurnIndex % playersArr.length];
    if (next && next.isBot) {
      const delay = 400 + Math.floor(Math.random() * 800);
      setTimeout(() => this._botTurn(next), delay);
    }
  }

  private _botTurn(bot: Player) {
    // Simple bot logic based on difficulty
    const diff = botMoveValue(bot.botDifficulty);
    bot.unicorns += diff;
    // Emit updated state after bot move
    this.emitState();
    // Check win after bot move
    if (bot.unicorns >= this.winScore()) {
      this.winner = bot.nickname;
      this.phase = 'finished';
      this.emitState();
      return;
    }
    // Move to next turn after bot move
    const playersArr = Array.from(this.players.values());
    this.currentTurnIndex = nextPlayerIndex(this.currentTurnIndex, playersArr.length);
    this.emitState();
    // If next is another bot, chain it with a small delay
    const next = playersArr[this.currentTurnIndex % playersArr.length];
    if (next && next.isBot) {
      const delay = 400 + Math.floor(Math.random() * 800);
      setTimeout(() => this._botTurn(next), delay);
    }
  }

  private emitState(): void {
    const state = this.getState();
    if (this.io) {
      this.io.to(`game:${this.roomId}`).emit('game_state', state);
    }
  }

  getState() {
    return buildStateView(this.roomId, this.phase, this.players, this.currentTurnIndex, this.winner);
  }

  simulateTimeline(maxTurns: number = 100): { winner?: string; turns: number; timeline: TimelineStep[] } {
    const timeline: TimelineStep[] = [];
    // Snapshot current players to work with
    const snapshot = Array.from(this.players.values());
    if (snapshot.length === 0) return { winner: this.winner, turns: 0, timeline };
    // Create a shallow copy of unicorns to avoid mutating original state during timeline sim
    const simPlayers = snapshot.map(p => ({ ...p }));
    let turns = 0;
    // Start fresh timeline from current phase/turn state
    let phase = this.phase;
    let currentTurnIndex = this.currentTurnIndex;
    while (turns < maxTurns && simPlayers.length > 0 && phase !== 'finished') {
      const current = simPlayers[currentTurnIndex % simPlayers.length];
      const inc = current.isBot ? botMoveValue(current.botDifficulty) : 1;
      current.unicorns = (current.unicorns ?? 0) + inc;
      timeline.push({ turn: turns + 1, player: current.nickname, unicorns: current.unicorns, phase, action: 'move' });
      if (current.unicorns >= this.winScore(simPlayers.length)) {
        this.winner = current.nickname;
        phase = 'finished';
        break;
      }
      currentTurnIndex = nextPlayerIndex(currentTurnIndex, simPlayers.length);
      turns++;
      phase = 'end';
    }
    return { winner: this.winner, turns, timeline };
  }

  public simulateAll(): { winner?: string; turns: number } {
    // Fast-forward without scheduling or IO delays
    let turns = 0;
    const playersArr = Array.from(this.players.values());
    if (playersArr.length === 0) return { turns: 0 };
    while (this.phase !== 'finished' && turns < 1000) {
      const current = playersArr[this.currentTurnIndex % playersArr.length];
      const inc = current?.isBot ? botMoveValue(current.botDifficulty) : 1;
      if (current) current.unicorns += inc;
      if (current && current.unicorns >= this.winScore(playersArr.length)) {
        this.winner = current.nickname;
        this.phase = 'finished';
        break;
      }
      this.currentTurnIndex = nextPlayerIndex(this.currentTurnIndex, playersArr.length);
      turns++;
      this.emitState();
      // Do not advance phase automatically in fast simulate to keep simple progression
    }
    return { winner: this.winner, turns };
  }

  private nextPhase(): void {
    // Порядок фаз и правила перехода — в rules.ts (чистая функция nextPhaseOf).
    // Здесь только применение результата к состоянию и эмит.
    const step = nextPhaseOf(this.phase, this.phases);
    if (!step.changed) return; // 'end'/'finished' — ход завершает endTurn

    this.phase = step.phase;
    this.phaseIndex = step.phaseIndex;

    if (step.advanceTurn) {
      // Wrap-around: конец хода, сдвигаем текущего игрока
      const playersArr = Array.from(this.players.values());
      if (playersArr.length > 0) {
        this.currentTurnIndex = nextPlayerIndex(this.currentTurnIndex, playersArr.length);
      }
    }

    if (step.emit) this.emitState();
  }
}

export default GameInstance;
