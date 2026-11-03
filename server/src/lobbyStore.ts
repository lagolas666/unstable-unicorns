export type Room = {
  id: string;
  name: string;
  maxPlayers: number;
  players: string[];
  status: 'waiting' | 'in_progress';
  createdAt: number;
};

class LobbyStore {
  private rooms: Map<string, Room> = new Map();
  private nextId = 1;

  createRoom(name: string, maxPlayers: number = 8): Room {
    const id = `R${this.nextId++}`;
    const room: Room = { id, name, maxPlayers, players: [], status: 'waiting', createdAt: Date.now() };
    this.rooms.set(id, room);
    return room;
  }

  getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  joinRoom(id: string, playerId: string): Room | null {
    const r = this.rooms.get(id);
    if (!r) return null;
    if (r.players.includes(playerId)) return r;
    if (r.players.length >= r.maxPlayers) return null;
    r.players.push(playerId);
    return r;
  }

  leaveRoom(id: string, playerId: string): Room | null {
    const r = this.rooms.get(id);
    if (!r) return null;
    r.players = r.players.filter(p => p !== playerId);
    return r;
  }

  startRoom(id: string): Room | null {
    const r = this.rooms.get(id);
    if (!r) return null;
    if (r.status === 'in_progress') return r;
    r.status = 'in_progress';
    return r;
  }
}

export default new LobbyStore();
