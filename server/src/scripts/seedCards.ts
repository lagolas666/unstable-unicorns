import dotenv from 'dotenv';
import mongoose from 'mongoose';
import CardModel from '../models/Card';

dotenv.config();

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/uu';

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log('Connected to Mongo');

  const cards: Array<Parameters<typeof CardModel.create>[0]> = [
    // Basic Unicorns
    { name: 'Базовый Единорог A', type: 'basic_unicorn', description: 'Простой единорог без эффектов', image: '' , effects: []},
    { name: 'Базовый Единорог B', type: 'basic_unicorn', description: 'Простой единорог без эффектов', image: '' , effects: []},
    { name: 'Базовый Единорог C', type: 'basic_unicorn', description: 'Простой единорог без эффектов', image: '' , effects: []},

    // Magical Unicorns (with while_in_stable effects)
    { name: 'Магический Единорог: Щит', type: 'magical_unicorn', description: 'Пока в стойле: защита от уничтожения', effects: [
      { trigger: 'while_in_stable', actions: [ { kind: 'protect', targets: { scope: 'self', zone: 'stable' } } ] }
    ]},
    { name: 'Магический Единорог: Порядок', type: 'magical_unicorn', description: 'В начале вашего хода: перетасуйте колоду', effects: [
      { trigger: 'on_turn_start', actions: [ { kind: 'shuffle_deck', targets: { scope: 'self', zone: 'deck' } } ] }
    ]},

    // Magic cards
    { name: 'Магия: Возьми 1', type: 'magic', description: 'Возьмите 1 карту', effects: [
      { trigger: 'immediate', actions: [ { kind: 'add', source: 'deck', destination: 'hand', quantity: { mode: 'exact', value: 1 } } ] }
    ]},
    { name: 'Магия: Возьми 2', type: 'magic', description: 'Возьмите 2 карты', effects: [
      { trigger: 'immediate', actions: [ { kind: 'add', source: 'deck', destination: 'hand', quantity: { mode: 'exact', value: 2 } } ] }
    ]},
    { name: 'Магия: Поиск 1', type: 'magic', description: 'Найдите 1 карту из колоды (упрощено)', effects: [
      { trigger: 'immediate', actions: [ { kind: 'search', targets: { scope: 'self', zone: 'deck', quantity: { mode: 'exact', value: 1 } } } ] }
    ]},
    { name: 'Магия: Уничтожь', type: 'magic', description: 'Уничтожьте 1 карту в стойле оппонента (упрощено)', effects: [
      { trigger: 'immediate', actions: [ { kind: 'destroy', targets: { scope: 'opponent', zone: 'stable', quantity: { mode: 'exact', value: 1 } } } ] }
    ]},

    // Instant cards
    { name: 'Мгновенная: Ней', type: 'instant', instant_subtype: 'neigh', description: 'Отмена розыгрыша (демо)', effects: [
      { trigger: 'immediate', actions: [ { kind: 'cancel', targets: { scope: 'opponent', zone: 'any' } } ] }
    ]},
    { name: 'Мгновенная: Супер Ней', type: 'instant', instant_subtype: 'super_neigh', description: 'Супер отмена (демо)', effects: [
      { trigger: 'immediate', actions: [ { kind: 'cancel', targets: { scope: 'any_player', zone: 'any' } } ] }
    ]},
    { name: 'Мгновенная: Щит', type: 'instant', instant_subtype: 'shield', description: 'Дай иммунитет к уничтожению на ход (демо)', effects: [
      { trigger: 'immediate', actions: [ { kind: 'grant_immunity', targets: { scope: 'self', zone: 'stable' }, immunity_to: ['destroy'] } ] }
    ]},

    // Upgrade / Downgrade
    { name: 'Апгрейд: Доп. действие', type: 'upgrade', description: 'Пока в стойле: +1 действие на ход', effects: [
      { trigger: 'on_turn_start', actions: [ { kind: 'extra_action', phase: 'play', value: 1 } ] }
    ]},
    { name: 'Апгрейд: Иммунитет к даунгрейдам', type: 'upgrade', description: 'Пока в стойле: иммунитет к даунгрейдам (демо)', effects: [
      { trigger: 'while_in_stable', actions: [ { kind: 'grant_immunity', targets: { scope: 'self', zone: 'stable' }, immunity_to: ['downgrade'] } ] }
    ]},
    { name: 'Даунгрейд: Ограничение', type: 'downgrade', description: 'Пока в стойле: лимит действий 0 (демо)', effects: [
      { trigger: 'while_in_stable', actions: [ { kind: 'limit_actions', phase: 'play', value: 0 } ] }
    ]},

    // Unicorn generic (kept for backward-compat with old UI)
    { name: 'Единорог (generic)', type: 'unicorn', description: 'Совместимость со старым UI', effects: [] },

    // Utility magic
    { name: 'Магия: Перетасуй колоду', type: 'magic', description: 'Перетасуйте свою колоду', effects: [
      { trigger: 'immediate', actions: [ { kind: 'shuffle_deck', targets: { scope: 'self', zone: 'deck' } } ] }
    ]},
    { name: 'Магия: Сбросите 1', type: 'magic', description: 'Сбросьте 1 карту из руки (упрощено)', effects: [
      { trigger: 'immediate', actions: [ { kind: 'discard', targets: { scope: 'self', zone: 'hand', quantity: { mode: 'exact', value: 1 } } } ] }
    ]},
    { name: 'Магия: Вернуть 1', type: 'magic', description: 'Верните 1 карту из сброса в руку (демо)', effects: [
      { trigger: 'immediate', actions: [ { kind: 'move', from: { scope: 'self', zone: 'discard', quantity: { mode: 'exact', value: 1 } }, to: { scope: 'self', zone: 'hand' } } ] }
    ]},

    // Turn-based triggers demo
    { name: 'Апгрейд: Добор в начале', type: 'upgrade', description: 'В начале вашего хода: возьмите 1', effects: [
      { trigger: 'on_turn_start', actions: [ { kind: 'add', source: 'deck', destination: 'hand', quantity: { mode: 'exact', value: 1 } } ] }
    ]},
    { name: 'Апгрейд: Сброс в конце', type: 'upgrade', description: 'В конце вашего хода: сбросьте 1 (демо)', effects: [
      { trigger: 'on_turn_end', actions: [ { kind: 'discard', targets: { scope: 'self', zone: 'hand', quantity: { mode: 'exact', value: 1 } } } ] }
    ]},

    // QA демо-карты для всех ключевых действий с фильтрами по типам
    { name: 'QA: Сброс магии', type: 'magic', description: 'Сбросьте 1 карту типа Магия из руки', effects: [
      { trigger: 'immediate', actions: [ { kind: 'move', from: { scope: 'self', zone: 'hand', filters: { card_group: 'magic' }, quantity: { mode: 'exact', value: 1 } }, to: { scope: 'self', zone: 'discard' } } ] }
    ]},
    { name: 'QA: Жертва апгрейда', type: 'magic', description: 'Пожертвуйте 1 апгрейд из стойла', effects: [
      { trigger: 'immediate', actions: [ { kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', filters: { card_group: 'upgrade' }, quantity: { mode: 'exact', value: 1 } } } ] }
    ]},
    { name: 'QA: Уничтожить даунгрейд', type: 'magic', description: 'Уничтожьте 1 даунгрейд у соперника', effects: [
      { trigger: 'immediate', actions: [ { kind: 'destroy', targets: { scope: 'opponent', zone: 'stable', filters: { card_group: 'downgrade' }, quantity: { mode: 'exact', value: 1 } } } ] }
    ]},
    { name: 'QA: Вернуть единорога в руку', type: 'magic', description: 'Верните 1 единорога из своего стойла в руку', effects: [
      { trigger: 'immediate', actions: [ { kind: 'move', from: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } }, to: { scope: 'self', zone: 'hand' } } ] }
    ]},
    { name: 'QA: Передать единорога', type: 'magic', description: 'Передайте 1 единорога сопернику', effects: [
      { trigger: 'immediate', actions: [ { kind: 'transfer', from: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } }, to: { scope: 'opponent', zone: 'stable' } } ] }
    ]},
    { name: 'QA: Украсть апгрейд', type: 'magic', description: 'Украдите 1 апгрейд у соперника', effects: [
      { trigger: 'immediate', actions: [ { kind: 'transfer', from: { scope: 'opponent', zone: 'stable', filters: { card_group: 'upgrade' }, quantity: { mode: 'exact', value: 1 } }, to: { scope: 'self', zone: 'stable' } } ] }
    ]},
    { name: 'QA: Обмен единорогами', type: 'magic', description: 'Обменяйтесь 1 единорогом', effects: [
      { trigger: 'immediate', actions: [ { kind: 'swap', a: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } }, b: { scope: 'opponent', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } } } ] }
    ]},
    { name: 'QA: Поиск апгрейда', type: 'magic', description: 'Найдите 1 апгрейд в колоде', effects: [
      { trigger: 'immediate', actions: [ { kind: 'search', targets: { scope: 'self', zone: 'deck', filters: { card_group: 'upgrade' }, quantity: { mode: 'exact', value: 1 } } } ] }
    ]},
    { name: 'QA: Показать единорога', type: 'magic', description: 'Покажите 1 единорога из колоды', effects: [
      { trigger: 'immediate', actions: [ { kind: 'reveal', targets: { scope: 'self', zone: 'deck', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } } } ] }
    ]},
    { name: 'QA: Вернуть даунгрейд в колоду', type: 'magic', description: 'Верните 1 даунгрейд из стойла в колоду', effects: [
      { trigger: 'immediate', actions: [ { kind: 'move', from: { scope: 'self', zone: 'stable', filters: { card_group: 'downgrade' }, quantity: { mode: 'exact', value: 1 } }, to: { scope: 'self', zone: 'deck' } } ] }
    ]},
  ];

  let upserts = 0;
  for (const c of cards) {
    const obj = c as Record<string, unknown>;
    const payload = { active: true, deck_count: 1, ...(obj as object) } as any;
    const res = await CardModel.updateOne(
      { name: payload.name },
      { $set: payload },
      { upsert: true }
    );
    if ((res as any).upsertedCount || (res as any).modifiedCount) upserts++;
  }

  const total = await CardModel.countDocuments();
  console.log(`Seeded/updated ${upserts} cards. Total in DB: ${total}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
