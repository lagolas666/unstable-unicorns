import mongoose, { Schema, InferSchemaType } from 'mongoose';

// New DSL enums (minimal validation in schema to remain flexible)
const TRIGGERS = [
  'immediate',
  'on_play',
  'on_discard',
  'on_destroy',
  'on_turn_start',
  'on_turn_end',
  'while_in_stable',
  'when_other_plays',
  'after_resolve',
  'on_enter_stable',
  'on_sacrifice',
  // Custom importer triggers
  'when_other_unicorn_would_be_sacrificed_or_returned',
  'when_other_brings_baby_from_nursery',
] as const;

// Effects now store trigger/conditions/actions blobs with light enum checks
const EffectSchema = new Schema(
  {
    trigger: { type: String, enum: TRIGGERS, required: true },
    conditions: { type: [Schema.Types.Mixed], default: [] },
    actions: { type: [Schema.Types.Mixed], required: true },
  },
  { _id: false }
);

const CardSchema = new Schema(
  {
    name: { type: String, required: true },
    // Expanded categories per wiki + backward-compat generic types
    type: {
      type: String,
      enum: [
        'baby_unicorn',
        'basic_unicorn',
        'magical_unicorn',
        'ultimate_unicorn',
        'magic',
        'instant',
        'upgrade',
        'downgrade',
        'unicorn',
      ],
      required: true,
    },
    subtype: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    // Admin controls
    active: { type: Boolean, default: true },
    deck_count: { type: Number, default: 1, min: 0 },
    counts_for_win: { type: Boolean, default: true },
    blocks_unicorn_effects: { type: Boolean, default: false },
    cannot_be_neighed: { type: Boolean, default: false },
    blocks_neigh_for_others: { type: Boolean, default: false },
    blocks_instants_against_owner: { type: Boolean, default: false },
    skip_phases: [{ type: String, enum: ['draw', 'play', 'instant', 'discard', 'end'] }],
    // Поддержка всех типов инстантов, используемых маршрутизатором игры
    instant_subtype: { type: String, enum: ['neigh', 'super_neigh', 'rewind', 'shield', 'redirect', 'intercept'], required: false },
    play_requirements: {
      type: new Schema(
        {
          conditions: { type: [Schema.Types.Mixed], default: [] },
          costs: { type: [Schema.Types.Mixed], default: [] },
        },
        { _id: false }
      ),
      required: false,
    },
    effects: { type: [EffectSchema], default: [] },
  },
  { timestamps: true }
);

export type CardDoc = InferSchemaType<typeof CardSchema> & { _id: mongoose.Types.ObjectId };

CardSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

// Indexes for faster search/filter
CardSchema.index({ type: 1, active: 1 });
// Text index for simple search by name/description
try {
  CardSchema.index({ name: 'text', description: 'text' });
} catch {}

export default mongoose.model<CardDoc>('Card', CardSchema);
