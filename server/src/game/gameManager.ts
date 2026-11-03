import GameInstance from './gameInstance';
import { Server as SocketIOServer } from 'socket.io';

class GameManager {
  private games: Map<string, GameInstance> = new Map();

  getOrCreateGame(roomId: string, io?: SocketIOServer): GameInstance {
    let g = this.games.get(roomId);
    if (!g) {
      g = new GameInstance(roomId, io, 8);
      this.games.set(roomId, g);
    }
    // ensure io reference
    if (io) g.io = io;
    return g;
  }

  removeGame(roomId: string): void {
    this.games.delete(roomId);
  }

  addBotToRoom(roomId: string, nickname: string, diff: 'easy'|'normal'|'hard' = 'easy', io?: SocketIOServer) {
    let g = this.games.get(roomId);
    if (!g) {
      g = new GameInstance(roomId, io, 8);
      this.games.set(roomId, g);
    }
    g.addBotToRoom(nickname, diff);
  }
}

export default new GameManager();
