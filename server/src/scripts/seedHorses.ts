import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/uu_new'

// Minimal unicorn schema for seeding only
const unicornSchema = new mongoose.Schema({
  name: String,
  power: Number,
  rarity: String,
  type: String,
  createdAt: { type: Date, default: Date.now }
})

const Unicorn = mongoose.model('Unicorn', unicornSchema, 'unicorns')

async function main() {
  try {
    // Connect to MongoDB using the standard URL; modern drivers ignore deprecated options
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB for unicorn seeding')

    const existing = await Unicorn.estimatedDocumentCount()
    if (existing > 0) {
      console.log(`Unicorn collection already seeded (${existing} documents). Skipping seeding.`)
      process.exit(0)
    }

    const horses = [
      { name: 'Celestial Spark', power: 5, rarity: 'legendary', type: 'unicorn' },
      { name: 'Moonlit Mane', power: 4, rarity: 'epic', type: 'unicorn' },
      { name: 'Crimson Horn', power: 6, rarity: 'mythic', type: 'unicorn' },
      { name: 'Starlight Pony', power: 3, rarity: 'rare', type: 'unicorn' },
      { name: 'Golden Gleam', power: 4, rarity: 'rare', type: 'unicorn' },
    ]

    const res = await Unicorn.insertMany(horses)
    console.log(`Seeded ${res.length} unicorns into 'unicorns' collection`)
  } catch (err) {
    console.error('Error seeding unicorns:', err)
  } finally {
    await mongoose.disconnect()
  }
}

main()
