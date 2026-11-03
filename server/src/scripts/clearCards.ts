import 'dotenv/config';
import mongoose from 'mongoose';
import Card from '../models/Card';

/*
  Safe DB cleanup for development.
  Usage:
    ts-node-dev --transpile-only src/scripts/clearCards.ts --force

  Options:
    --force   required flag to actually perform deletion

  Notes:
    - Connects to MONGODB_URI (defaults to mongodb://127.0.0.1:27017/uu_new)
    - Drops only cards collection contents (deleteMany), not the whole DB
    - Exits with non-zero code if --force is missing
*/

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const force = hasFlag('force');
  if (!force) {
    console.error('[clearCards] Refusing to run without --force');
    process.exit(2);
  }
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/uu_new';
  await mongoose.connect(uri);
  try {
    const count = await Card.countDocuments({});
    console.log(`[clearCards] Connected. Cards in collection: ${count}`);
    const res = await Card.deleteMany({});
    console.log(`[clearCards] Deleted ${res.deletedCount ?? 0} cards.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
