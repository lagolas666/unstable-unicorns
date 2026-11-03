export function findPlayer(state: any, id: string): any {
  return state.players.find((p: any) => p.id === id);
}

export function stableOf(state: any, id: string): string[] {
  const p = findPlayer(state, id);
  return p?.stable ?? [];
}

export function handOf(state: any, id: string): string[] {
  const p = findPlayer(state, id);
  return p?.hand ?? [];
}

export function discardOf(state: any, id: string): string[] {
  const p = findPlayer(state, id);
  return p?.discard ?? [];
}
