const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Basic', 'Magic', 'Nightmare', 'Ultimate', 'Instant', 'Upgrade', 'Downgrade', 'Baby'],
    required: true
  },
  effect: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  attributes: {
    color: String,
    rarity: String,
    special: String
  },
  image: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Card', cardSchema);
