import { Router } from 'express';
import Card from '../models/Card';

type AnyEffect = any;

function normalizeLegacyEffects(effects: AnyEffect[] | undefined): AnyEffect[] | undefined {
  if (!effects) return effects;
  // If already DSL (presence of trigger/actions), return as-is
  if (effects.every((e) => e && (e.trigger || e.actions))) return effects as AnyEffect[];

  // Map minimal legacy subset used by current admin: 'add' (draw/move) and 'destroy'
  return effects.map((e) => {
    if (!e || typeof e !== 'object') return e;
    const type = e.type as string;
    const trigger = (e.trigger as string) || 'immediate';
    if (type === 'add') {
      const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : undefined;
      const src = e.source || 'deck';
      const dst = e.destination || 'hand';
      // Classic draw: keep as 'add'
      if (src === 'deck' && dst === 'hand') {
        return {
          trigger,
          actions: [
            {
              kind: 'add',
              source: src,
              destination: dst,
              quantity,
            },
          ],
        };
      }
      // Otherwise treat as a move between zones (e.g., from discard to hand)
      const filters: any = {};
      if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
      return {
        trigger,
        actions: [
          {
            kind: 'move',
            from: { scope: 'self', zone: src, filters: Object.keys(filters).length ? filters : undefined, quantity },
            to: { scope: 'self', zone: dst },
          },
        ],
      };
    }
    if (type === 'destroy') {
      // default: destroy 1 card from stable (any player) with optional filter by card_type
      const filters: any = {};
      if (e.card_type && e.card_type !== 'any') {
        // map legacy to group/category heuristic
        filters.card_group = e.card_type;
      }
      const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : undefined;
      // if explicitly self => treat as sacrifice
      if (e.target === 'self') {
        return {
          trigger,
          actions: [
            {
              kind: 'sacrifice',
              targets: {
                scope: 'self',
                zone: 'stable',
                filters: Object.keys(filters).length ? filters : undefined,
                quantity,
              },
            },
          ],
        };
      }
      return {
        trigger,
        actions: [
          {
            kind: 'destroy',
            targets: {
              scope: e.target === 'opponent' ? 'opponent' : 'any_player',
              zone: 'stable',
              filters: Object.keys(filters).length ? filters : undefined,
              // destroying should not allow targeting own stable when scope is any
              ...(e.target !== 'opponent' ? { allow_self: false } : {}),
              quantity,
            },
          },
        ],
      };
    }
    if (type === 'discard') {
      const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : { mode: 'exact', value: 1 };
      const affects = (e.affects as 'self' | 'all' | 'others') || 'self';
      const fromSelector: any = {
        scope: affects === 'all' || affects === 'others' ? 'all_players' : 'self',
        zone: 'hand',
        quantity,
      };
      if (affects === 'others') fromSelector.allow_self = false;
      return {
        trigger,
        actions: [
          {
            kind: 'move',
            from: fromSelector,
            to: { scope: 'self', zone: 'discard' },
          },
        ],
      };
    }
    if (type === 'return') {
      // Move card(s) from stable back to hand/deck; target scope configurable
      const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : { mode: 'exact', value: 1 };
      const filters: any = {};
      if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
      return {
        trigger,
        actions: [
          {
            kind: 'move',
            from: {
              scope: e.target === 'opponent' ? 'opponent' : e.target === 'self' ? 'self' : 'any_player',
              zone: 'stable',
              filters: Object.keys(filters).length ? filters : undefined,
              quantity,
            },
            to: { scope: 'self', zone: e.destination === 'deck' ? 'deck' : 'hand' },
          },
        ],
      };
    }
    if (type === 'steal') {
      // From opponent stable to self stable
      const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : { mode: 'exact', value: 1 };
      const filters: any = {};
      if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
      return {
        trigger,
        actions: [
          {
            kind: 'transfer',
            from: { scope: 'opponent', zone: 'stable', filters: Object.keys(filters).length ? filters : undefined, quantity },
            to: { scope: 'self', zone: 'stable' },
          },
        ],
      };
    }
    if (type === 'give') {
      // From self stable to opponent stable
      const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : { mode: 'exact', value: 1 };
      const filters: any = {};
      if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
      return {
        trigger,
        actions: [
          {
            kind: 'transfer',
            from: { scope: 'self', zone: 'stable', filters: Object.keys(filters).length ? filters : undefined, quantity },
            to: { scope: 'opponent', zone: 'stable' },
          },
        ],
      };
    }
    if (type === 'swap') {
      // Swap one card between stables
      const filters: any = {};
      if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
      return {
        trigger,
        actions: [
          {
            kind: 'swap',
            a: { scope: 'self', zone: 'stable', filters: Object.keys(filters).length ? filters : undefined, quantity: { mode: 'exact', value: 1 } },
            b: { scope: 'opponent', zone: 'stable', filters: Object.keys(filters).length ? filters : undefined, quantity: { mode: 'exact', value: 1 } },
          },
        ],
      };
    }
    if (type === 'search') {
      // Search in deck with optional filter and quantity
      const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : { mode: 'exact', value: 1 };
      const filters: any = {};
      if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
      return {
        trigger,
        actions: [
          {
            kind: 'search',
            targets: { scope: 'self', zone: 'deck', filters: Object.keys(filters).length ? filters : undefined, quantity },
          },
        ],
      };
    }
    if (type === 'prevent' || type === 'protect' || type === 'shield') {
      return { trigger, actions: [{ kind: 'set_flag', name: 'prevent_effects', value: true }], legacy: e };
    }
    // Fallback: wrap unknown legacy as a flag for later manual migration
    return { trigger, actions: [{ kind: 'set_flag', name: 'legacy_payload', value: true }], legacy: e };
  });

}

const router = Router();

// GET /api/cards
// Query params:
//  - q: text search (name/description)
//  - type: Card.type exact match
//  - active: 'true' | 'false'
//  - limit, offset: pagination
//  - sort: comma list of fields, prefix '-' for desc (e.g., '-updatedAt,name')
router.get('/', async (req, res) => {
  try {
    const { q, type, active, limit, offset, sort } = req.query as Record<string, string | undefined>;
    const filter: any = {};
    if (type) filter.type = type;
    if (typeof active !== 'undefined') {
      if (active === 'true' || active === '1') filter.active = true;
      else if (active === 'false' || active === '0') filter.active = false;
    }
    if (q && q.trim()) {
      // Prefer text index if available
      filter.$text = { $search: q.trim() };
    }

    const lim = Math.max(0, Math.min(100, Number(limit) || 50));
    const off = Math.max(0, Number(offset) || 0);

    let sortSpec: any = { updatedAt: -1 };
    if (sort && sort.trim()) {
      sortSpec = {};
      for (const part of sort.split(',')) {
        const p = part.trim();
        if (!p) continue;
        if (p.startsWith('-')) sortSpec[p.substring(1)] = -1;
        else sortSpec[p] = 1;
      }
    }

    const [total, cards] = await Promise.all([
      Card.countDocuments(filter),
      Card.find(filter).sort(sortSpec).skip(off).limit(lim).lean(),
    ]);

    res.setHeader('X-Total-Count', String(total));
    // Ensure the browser can read total via CORS in case global middleware is bypassed
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, x-total-count');
    res.json(cards);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch cards' });
  }
});

// GET /api/cards/count - returns total count of cards matching optional filters
router.get('/count', async (req, res) => {
  try {
    const { q, type, active } = req.query as Record<string, string | undefined>;
    const filter: any = {};
    if (type) filter.type = type;
    if (typeof active !== 'undefined') {
      if (active === 'true' || active === '1') filter.active = true;
      else if (active === 'false' || active === '0') filter.active = false;
    }
    if (q && q.trim()) {
      filter.$text = { $search: q.trim() };
    }
    const total = await Card.countDocuments(filter);
    res.json({ total });
  } catch (err) {
    res.status(500).json({ message: 'Failed to count cards' });
  }
});

// GET /api/cards/:id
router.get('/:id', async (req, res) => {
  try {
    const card = await Card.findById(req.params.id).lean();
    if (!card) return res.status(404).json({ message: 'Card not found' });
    res.json(card);
  } catch (err) {
    res.status(400).json({ message: 'Invalid id' });
  }
});

// POST /api/cards
router.post('/', async (req, res) => {
  try {
    const body = { ...req.body };
    body.effects = normalizeLegacyEffects(body.effects);
    const created = await Card.create(body);
    res.status(201).json(created.toJSON());
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map((e: any) => e.message || String(e));
      return res.status(400).json({ message: 'Validation error', errors });
    }
    res.status(500).json({ message: 'Failed to create card' });
  }
});

// PUT /api/cards/:id
router.put('/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    body.effects = normalizeLegacyEffects(body.effects);
    const updated = await Card.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Card not found' });
    res.json(updated.toJSON());
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map((e: any) => e.message || String(e));
      return res.status(400).json({ message: 'Validation error', errors });
    }
    res.status(500).json({ message: 'Failed to update card' });
  }
});

// DELETE /api/cards/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Card.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Card not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: 'Invalid id' });
  }
});

export default router;
