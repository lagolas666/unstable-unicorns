import request from 'supertest';
import app from '../../src/testApp';

// Lightweight API helpers for tests. These do not change existing tests,
// but allow writing new/refactored tests in a concise and consistent way.

export async function createGame(state: any): Promise<string> {
  const res = await request(app).post('/api/game/test/create').send({ state });
  if (res.status !== 200) {
    throw new Error(`createGame failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
}

export async function setGame(gameId: string, statePatch: any): Promise<any> {
  const res = await request(app).post(`/api/game/test/set/${gameId}`).send({ state: statePatch });
  if (res.status !== 200) {
    throw new Error(`setGame failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export async function getState(gameId: string): Promise<any> {
  const res = await request(app).get(`/api/game/test/state/${gameId}`).send();
  if (res.status !== 200) {
    throw new Error(`getState failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.state as any;
}

export async function playWithWindow(gameId: string, cardId: string): Promise<any> {
  const res = await request(app).post(`/api/game/${gameId}/playWithWindow`).send({ cardId });
  return res;
}

export async function playWithTargets(
  gameId: string,
  payload: { cardId: string; targets?: string[]; targetPlayerId?: string }
): Promise<any> {
  const res = await request(app).post(`/api/game/${gameId}/playWithTargets`).send(payload);
  return res;
}

export async function play(
  gameId: string,
  cardId: string,
  extra?: Record<string, unknown>
): Promise<any> {
  return request(app)
    .post(`/api/game/${gameId}/play`)
    .send(extra ? { cardId, ...extra } : { cardId });
}

export async function resolvePending(gameId: string, body: Record<string, unknown> = {}): Promise<any> {
  // body: { cardId?, skip?, confirm?, byPlayerId? } — см. docs/API_CONTRACT.md §1.5
  const res = await request(app).post(`/api/game/${gameId}/resolvePending`).send(body);
  return res;
}

export async function turnStart(gameId: string): Promise<any> {
  return request(app).post(`/api/game/${gameId}/turnStart`).send();
}

export async function turnStartChoose(
  gameId: string,
  payload: { choice: 'use' | 'skip'; promptIndex?: number; targets?: string[]; targetPlayerId?: string }
): Promise<any> {
  return request(app).post(`/api/game/${gameId}/turnStart/choose`).send(payload);
}

export async function reactNeigh(gameId: string, byPlayerId: string, instantCardId: string): Promise<any> {
  return request(app).post(`/api/game/${gameId}/react/neigh`).send({ byPlayerId, instantCardId });
}

export async function reactCounterNeigh(gameId: string, byPlayerId: string, instantCardId: string): Promise<any> {
  return request(app).post(`/api/game/${gameId}/react/counter_neigh`).send({ byPlayerId, instantCardId });
}

export async function reactSuperNeigh(gameId: string, byPlayerId: string, instantCardId: string): Promise<any> {
  // Super Neigh использует тот же эндпоинт, что и обычный neigh; карта отличает тип реакции
  return request(app).post(`/api/game/${gameId}/react/neigh`).send({ byPlayerId, instantCardId });
}

export async function reactRewind(gameId: string, byPlayerId: string, instantCardId: string): Promise<any> {
  return request(app).post(`/api/game/${gameId}/react/rewind`).send({ byPlayerId, instantCardId });
}

export async function reactRedirect(
  gameId: string,
  byPlayerId: string,
  instantCardId: string,
  toTargetId: string
): Promise<any> {
  return request(app).post(`/api/game/${gameId}/react/redirect`).send({ byPlayerId, instantCardId, toTargetId });
}

export async function reactInterceptSteal(
  gameId: string,
  byPlayerId: string,
  instantCardId: string,
  receiverPlayerId?: string
): Promise<any> {
  return request(app)
    .post(`/api/game/${gameId}/react/intercept_steal`)
    .send(receiverPlayerId ? { byPlayerId, instantCardId, receiverPlayerId } : { byPlayerId, instantCardId });
}

export async function reactPrevent(gameId: string, byPlayerId: string): Promise<any> {
  return request(app).post(`/api/game/${gameId}/react/prevent`).send({ byPlayerId });
}

export async function reactIgnoreTarget(gameId: string, byPlayerId: string, targetId: string): Promise<any> {
  return request(app).post(`/api/game/${gameId}/react/ignore_target`).send({ byPlayerId, targetId });
}

export async function reactHypnorog(
  gameId: string,
  byPlayerId: string,
  discardCardId: string
): Promise<any> {
  return request(app).post(`/api/game/${gameId}/react/hypnorog`).send({ byPlayerId, discardCardId });
}
