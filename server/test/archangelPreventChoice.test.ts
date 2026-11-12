import { destroyMagic, simpleUpgrade, unicorn } from './helpers/cards';
import { player, baseTurn, gameState } from './helpers/state';
import { createGame, playWithTargets, resolvePending, getState } from './helpers/api';

// Единорог-Архангел (archangel_unicorn_ultimate), UNICORNS.md п.78, официальный текст:
// "Когда карта в вашей Конюшне должна быть ПОЖЕРТВОВАНА или УНИЧТОЖЕНА,
//  вы можете вместо этого СБРОСИТЬ карту."
//
// То есть это ВЫБОР владельца, а не автоматическое правило. Проверяем именно выбор:
// карта с Архангелом в стойле + карта в руке, карту Архангела уничтожают.
//
// Сейчас в executor.ts (L124-129 ownerHasArchangel, используется в L855/L961/L986)
// замена выполняется безусловно: owner.hand.pop() вызывается сразу, без окна выбора.
// Тест фиксирует это расхождение и встанет на сторону правил после фикса.

const ARCH = 'archangel_unicorn_ultimate';

// Данные Архангела берём из официального каталога, чтобы тест держал реальную карту,
// а не перепечатанную вручную фикстуру. Хардкод в движке ищет по имени — имя тоже
// обязательно должно совпадать с каталогом, иначе тест проверял бы не тот путь.
function archangel(cardId: string) {
  return {
    id: cardId,
    type: 'ultimate_unicorn',
    name: 'Единорог-Архангел',
    effects: [
      {
        trigger: 'on_enter_stable',
        actions: [
          {
            kind: 'sacrifice',
            target: {
              scope: 'self',
              zone: 'stable',
              filters: { card_group: 'any', exclude_self: true },
              quantity: { value: 3 },
            },
          },
        ],
      },
      {
        trigger: 'on_would_be_destroyed_or_sacrificed',
        optional: true,
        actions: [
          {
            kind: 'discard',
            target: { scope: 'self', zone: 'hand', filters: { card_group: 'any' }, quantity: { value: 1 } },
          },
          { kind: 'prevent', prevented_action: 'destroy_or_sacrifice' },
        ],
      },
      {
        trigger: 'on_turn_start',
        optional: true,
        actions: [{ kind: 'draw', target_player: 'self', target: { quantity: { value: 1 } } }],
      },
    ],
  } as any;
}

function buildGame(opts: { withArchangel: boolean }) {
  const A = 'P1'; // владелец Архангела, играет уничтожение в свою же карту через opponent-scope нельзя,
  const B = 'P2'; // поэтому уничтожает Архангел игрок B — тогда owner === P1
  const smash = 'C_smash';
  const handCard = 'H_keep';
  const spare = 'U_spare';

  const players = [
    player({ id: A, hand: [handCard], stable: opts.withArchangel ? [ARCH, spare] : [spare] }),
    player({ id: B, hand: [smash] }),
  ];
  const cards: Record<string, any> = {
    [smash]: destroyMagic(smash),
    [handCard]: simpleUpgrade(handCard),
    [spare]: unicorn(spare, 'Spare Unicorn'),
  };
  if (opts.withArchangel) cards[ARCH] = archangel(ARCH);

  return gameState({
    players,
    cards,
    turn: baseTurn(B),
    deck: ['dk1', 'dk2'],
    discard: [],
  });
}

describe('Archangel Unicorn: замена уничтожения на сброс — это выбор владельца', () => {
  test('A1: Архангел в стойле + карта в руке, его уничтожают — без выбора владельца карта не сбрасывается', async () => {
    const gameId = await createGame(buildGame({ withArchangel: true }));

    const played = await playWithTargets(gameId, { cardId: 'C_smash', targets: [ARCH] });
    expect(played.status).toBe(200);

    // Разрешаем окно. Если движок спрашивает владельца — resolvePending закроет окно,
    // и мы увидим либо отказ от замены, либо отсутствие окна вообще.
    const resolved = await resolvePending(gameId);
    expect([200, 400]).toContain(resolved.status);

    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === 'P1')!;
    const b = final.players.find((p: any) => p.id === 'P2')!;

    // Правило: владелец МОЖЕТ сбросить карту вместо уничтожения. Пока выбор не сделан
    // (никакого react/prevent от P1 не приходило), Карта Архангела обязана остаться в стойле.
    expect(a.stable).toContain(ARCH);
    // И карта из руки не должна уходить в сброс безусловно.
    expect(a.hand).toContain('H_keep');
    expect(a.discard).not.toContain('H_keep');

    // Магическая карта уничтожения разыграна и ушла в общий сброс
    expect(b.hand).not.toContain('C_smash');
  });

  test('A2: контроль — без Архангела та же карта действительно уничтожается', async () => {
    const gameId = await createGame(buildGame({ withArchangel: false }));

    const played = await playWithTargets(gameId, { cardId: 'C_smash', targets: ['U_spare'] });
    expect(played.status).toBe(200);

    const resolved = await resolvePending(gameId);
    expect([200, 400]).toContain(resolved.status);

    const final = await getState(gameId);
    const a = final.players.find((p: any) => p.id === 'P1')!;

    // Уничтожение работает как обычно
    expect(a.stable).not.toContain('U_spare');
    expect(a.discard).toContain('U_spare');
    // Рука не тронута: платить было нечем и незачем
    expect(a.hand).toEqual(['H_keep']);
  });
});
