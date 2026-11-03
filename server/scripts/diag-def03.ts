// Диагностика DEF-03: воспроизводим reaction_triggers.test.ts:182 и печатаем тело 400 + logs
import request from 'supertest';
import app from '../src/testApp';

const A = 'P1';
const B = 'P2';

const enterDestroy = 'U_ENTER_DESTROY_UNC';
const t1 = 'BT1';
const t2 = 'BT2';
const neigh = 'N';
const cneigh = 'CN';
const red = 'R';

const unicorn = (id: string, name: string) => ({ id, type: 'unicorn', name, effects: [] } as any);

const state = {
  players: [
    { id: A, deck: [], hand: [enterDestroy], discard: [], stable: [], nursery: [], field: [], action_points: 1 },
    { id: B, deck: [], hand: [neigh, cneigh, red], discard: [], stable: [t1, t2], nursery: [], field: [], action_points: 1 },
  ],
  cards: {
    [enterDestroy]: {
      id: enterDestroy,
      type: 'unicorn',
      name: 'Unicorn Enter: Destroy1 (Uncounterable)',
      effects: [
        {
          trigger: 'immediate',
          uncounterable: true,
          actions: [
            {
              kind: 'destroy',
              targets: {
                scope: 'opponent',
                zone: 'stable',
                quantity: { value: 1 },
                filters: { card_group: 'any' },
              },
            },
          ],
        },
      ],
    } as any,
    [t1]: unicorn(t1, 'T1'),
    [t2]: unicorn(t2, 'T2'),
    [neigh]: { id: neigh, type: 'instant', name: 'Neigh', instant_subtype: 'neigh' } as any,
    [cneigh]: { id: cneigh, type: 'instant', name: 'Counter Neigh', instant_subtype: 'counter_neigh' } as any,
    [red]: { id: red, type: 'instant', name: 'Redirect', instant_subtype: 'redirect' } as any,
  },
  turn: { currentPlayerId: A, phase: 'action', has_drawn: false },
  deck: [],
  discard: [],
};

async function main() {
  const created = await request(app).post('/api/game/test/create').send({ state });
  console.log('create:', created.status, JSON.stringify(created.body).slice(0, 300));
  const gameId = created.body.id;

  const start = await request(app).post(`/api/game/${gameId}/playWithWindow`).send({ cardId: enterDestroy });
  console.log('\n=== playWithWindow ===');
  console.log('status:', start.status);
  console.log('pending:', JSON.stringify(start.body.pending));

  const r1 = await request(app).post(`/api/game/${gameId}/react/neigh`).send({ byPlayerId: B, instantCardId: neigh });
  console.log('\n=== react/neigh (ожидаем 400) ===');
  console.log('status:', r1.status);
  console.log('body:', JSON.stringify(r1.body));

  const r2 = await request(app).post(`/api/game/${gameId}/react/counter_neigh`).send({ byPlayerId: B, instantCardId: cneigh });
  console.log('\n=== react/counter_neigh (ожидаем 400) ===');
  console.log('status:', r2.status);
  console.log('body:', JSON.stringify(r2.body));

  const rr = await request(app).post(`/api/game/${gameId}/react/redirect`).send({ byPlayerId: B, instantCardId: red, toTargetId: t2 });
  console.log('\n=== react/redirect (ожидаем 200) ===');
  console.log('status:', rr.status);
  console.log('body:', JSON.stringify(rr.body));

  const st = await request(app).get(`/api/game/test/state/${gameId}`);
  const raw = st.body.state || {};
  const logs = raw.logs || [];
  console.log('\n=== debug logs react/redirect ===');
  for (const l of logs) {
    if (l?.details?.where === 'react/redirect') console.log('  ', JSON.stringify(l.details));
  }
  const bp = (raw.players || []).find((p: any) => p.id === B);
  const ap = (raw.players || []).find((p: any) => p.id === A);
  console.log('\nB hand:', JSON.stringify(bp?.hand), 'B stable:', JSON.stringify(bp?.stable));
  console.log('A stable:', JSON.stringify(ap?.stable));
}

main().catch(e => { console.error(e); process.exit(1); });
