// Временный замер: сколько занимает POST /api/game (DEF-06)
// Запуск: cross-env NODE_ENV=test ts-node --transpile-only scripts/measure-def06.ts
import request from 'supertest';
import app from '../src/index';

async function main() {
  const started = Date.now();
  const res = await request(app)
    .post('/api/game')
    .send({ players: [{ id: 'P1' }, { id: 'P2' }, { id: 'P3' }] });
  const ms = Date.now() - started;
  console.log('STATUS=' + res.status);
  console.log('MS=' + ms);
  console.log('HAS_ID=' + Boolean(res.body && res.body.id));
  const state = res.body && res.body.state;
  console.log('HAS_STATE=' + Boolean(state));
  if (state) {
    console.log('CURRENT_PLAYER=' + (state.turn && state.turn.currentPlayerId));
    console.log('PLAYERS=' + (state.players || []).map((p: any) => p.id + ':' + (p.hand || []).length).join(','));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
