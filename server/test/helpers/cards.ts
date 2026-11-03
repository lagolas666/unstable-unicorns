// Common card factory helpers for tests

export function unicorn(cardId: string, name = 'Test Unicorn') {
  return { id: cardId, type: 'basic_unicorn', name, effects: [] } as any;
}

export function destroyMagic(cardId: string) {
  return {
    id: cardId,
    type: 'magic',
    name: 'Smash',
    effects: [
      {
        trigger: 'on_play',
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
  } as any;
}

export function unicornWhenDestroyedDestroy(cardId: string) {
  // Единорог с триггером when_destroyed: уничтожьте 1 карту в стойле оппонента
  return {
    id: cardId,
    type: 'basic_unicorn',
    name: 'Unicorn WD: Destroy1',
    effects: [
      {
        trigger: 'when_destroyed',
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
  } as any;
}

export function unicornImmediateStealAllowIntercept(cardId: string) {
  // Единорог с immediate when_enters эффектом: украдите 1 единорога (разрешён intercept)
  return {
    id: cardId,
    type: 'basic_unicorn',
    name: 'Unicorn Enter: Steal1 (Interceptable)',
    effects: [
      {
        trigger: 'immediate',
        actions: [
          {
            kind: 'steal',
            allow_intercept: true,
            from: {
              scope: 'opponent',
              zone: 'stable',
              quantity: { value: 1 },
              filters: { card_group: 'unicorn' },
            },
            to: { scope: 'self', zone: 'stable' },
          },
        ],
      },
    ],
  } as any;
}

export function unicornImmediateDestroyUncounterable(cardId: string) {
  // Единорог с immediate эффектом destroy и флагом uncounterable (не гасится neigh/counter)
  return {
    id: cardId,
    type: 'basic_unicorn',
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
  } as any;
}

export function hypnorog(cardId: string) {
  // Карта-аура: пока в стойле владельца, позволяет отменять эффекты единорогов оппонентов ценой сброса 1 карты (см. executor глобальную логику)
  return {
    id: cardId,
    type: 'magical_unicorn',
    name: 'Hypnorog (Test)',
    blocks_unicorn_effects: true,
    effects: [],
  } as any;
}

export function nightmareStartCard(cardId: string) {
  // Optional on_turn_start: move 1 unicorn from shared discard to self stable; uncounterable
  return {
    id: cardId,
    type: 'basic_unicorn',
    name: 'Nightmare Unicorn (Test)',
    effects: [
      {
        trigger: 'on_turn_start',
        optional: true,
        uncounterable: true,
        actions: [
          {
            kind: 'move',
            from: {
              scope: 'self',
              zone: 'discard',
              quantity: { value: 1 },
              filters: { card_group: 'unicorn' },
            },
            to: { scope: 'self', zone: 'stable' },
          },
        ],
      },
    ],
  } as any;
}

export function destroyMagicUncounterable(cardId: string) {
  return {
    id: cardId,
    type: 'magic',
    name: 'Smash (Uncounterable)',
    effects: [
      {
        trigger: 'on_play',
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
  } as any;
}

export function destroyMagicQty(cardId: string, qty: number) {
  return {
    id: cardId,
    type: 'magic',
    name: `Smash x${qty}`,
    effects: [
      {
        trigger: 'on_play',
        actions: [
          {
            kind: 'destroy',
            targets: {
              scope: 'opponent',
              zone: 'stable',
              quantity: { value: qty },
              filters: { card_group: 'any' },
            },
          },
        ],
      },
    ],
  } as any;
}

export function stealMagic(cardId: string) {
  return {
    id: cardId,
    type: 'magic',
    name: 'Snatch',
    effects: [
      {
        trigger: 'on_play',
        actions: [
          {
            kind: 'steal',
            from: {
              scope: 'opponent',
              zone: 'stable',
              quantity: { value: 1 },
              filters: { card_group: 'any' },
            },
            to: { scope: 'self', zone: 'stable' },
          },
        ],
      },
    ],
  } as any;
}

export function instantRedirect(cardId: string) {
  return { id: cardId, type: 'instant', name: 'Redirect', instant_subtype: 'redirect' } as any;
}

export function instantIntercept(cardId: string) {
  return { id: cardId, type: 'instant', name: 'Intercept', instant_subtype: 'intercept' } as any;
}

export function instantNeigh(cardId: string) {
  return { id: cardId, type: 'instant', name: 'Neigh', instant_subtype: 'neigh' } as any;
}

export function instantSuperNeigh(cardId: string) {
  return { id: cardId, type: 'instant', name: 'Super Neigh', instant_subtype: 'super_neigh' } as any;
}

export function instantCounterNeigh(cardId: string) {
  return { id: cardId, type: 'instant', name: 'Counter Neigh', instant_subtype: 'counter_neigh' } as any;
}

export function instantRewind(cardId: string) {
  return { id: cardId, type: 'instant', name: 'Rewind', instant_subtype: 'rewind' } as any;
}

export function simpleUpgrade(cardId: string) {
  return { id: cardId, type: 'upgrade', name: 'Simple Upgrade', effects: [] } as any;
}

export function simpleDowngrade(cardId: string) {
  return { id: cardId, type: 'downgrade', name: 'Simple Downgrade', effects: [] } as any;
}

export function geminiUnicorn(cardId: string) {
  // В начале хода: можно сбросить 1 карту. Если вы это сделаете, у вас будет +1 дополнительное действие в фазу игры.
  return {
    id: cardId,
    type: 'magical_unicorn',
    name: 'Gemini Unicorn (Test)',
    effects: [
      {
        trigger: 'on_turn_start',
        optional: true,
        // Блокируется, если игрок пропускает фазу play (нет смысла давать доп. действие)
        blocked_by_phase_skip: ['play'] as any,
        actions: [
          {
            kind: 'discard',
            targets: { scope: 'self', zone: 'hand', quantity: { value: 1 }, filters: { card_group: 'any' } },
          },
          {
            kind: 'extra_action',
            phase: 'play' as any,
            value: 1,
            requires_success_of_previous: true,
          },
        ],
      },
    ],
  } as any;
}

export function upgradeWithDestroy(cardId: string, actionName = 'UG Destroy') {
  return {
    id: cardId,
    type: 'upgrade',
    name: actionName,
    effects: [
      {
        trigger: 'on_play',
        actions: [
          {
            kind: 'destroy',
            targets: { scope: 'opponent', zone: 'stable', filters: { card_group: 'any' } },
            qty: 1,
          },
        ],
      },
    ],
  } as any;
}

export function discardCostMagic(cardId: string, qty = 1) {
  return {
    id: cardId,
    type: 'magic',
    name: 'CostDiscard',
    play_requirements: {
      costs: [
        {
          kind: 'discard',
          targets: {
            scope: 'self',
            zone: 'hand',
            quantity: { value: qty },
            filters: { card_group: 'any' },
          },
        },
      ],
    },
    effects: [],
  } as any;
}

export function sacrificeCostMagic(cardId: string, qty = 1) {
  return {
    id: cardId,
    type: 'magic',
    name: 'CostSacrifice',
    play_requirements: {
      costs: [
        {
          kind: 'sacrifice',
          targets: {
            scope: 'self',
            zone: 'stable',
            quantity: { value: qty },
            filters: { card_group: 'any' },
          },
        },
      ],
    },
    effects: [],
  } as any;
}

export function unicornDestroyOnPlay(cardId: string) {
  // Единорог с on_play эффектом разрушения 1 карты в стойле противника
  return {
    id: cardId,
    type: 'basic_unicorn',
    name: 'Unicorn Destroy (on_play)',
    effects: [
      {
        trigger: 'on_play',
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
  } as any;
}

export function unicornImmediateDestroy(cardId: string) {
  // Единорог с immediate эффектом (срабатывает при входе) — также должен блокироваться гипнорогом
  return {
    id: cardId,
    type: 'basic_unicorn',
    name: 'Unicorn Destroy (immediate)',
    effects: [
      {
        trigger: 'immediate',
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
  } as any;
}

export function unicornWhenDestroyedDraw(cardId: string) {
  // Единорог с триггером when_destroyed: доберите 1 карту из общей колоды в руку владельца
  return {
    id: cardId,
    type: 'basic_unicorn',
    name: 'Unicorn WD: Draw1',
    effects: [
      {
        trigger: 'when_destroyed',
        actions: [
          {
            kind: 'add',
            quantity: { value: 1 },
            source: 'deck',
            destination: 'hand',
          },
        ],
      },
    ],
  } as any;
}

export function rainbowLasso(cardId: string) {
  // Апгрейд: в начале вашего хода вы можете сбросить 3 карты. Если вы это сделаете, украдите 1 единорога из стойла оппонента.
  // Эффект окна on_turn_start — uncounterable (Neigh/Counter Neigh не работают), но действие steal допускает Intercept.
  return {
    id: cardId,
    type: 'upgrade',
    name: 'Rainbow Lasso (Test)',
    effects: [
      {
        trigger: 'on_turn_start',
        optional: true,
        uncounterable: true,
        actions: [
          {
            kind: 'discard',
            targets: {
              scope: 'self',
              zone: 'hand',
              quantity: { value: 3 },
              filters: { card_group: 'any' },
            },
          },
          {
            kind: 'steal',
            allow_intercept: true,
            from: {
              scope: 'opponent',
              zone: 'stable',
              quantity: { value: 1 },
              filters: { card_group: 'unicorn' },
            },
            to: { scope: 'self', zone: 'stable' },
            requires_success_of_previous: true,
          },
        ],
      },
    ],
  } as any;
}
