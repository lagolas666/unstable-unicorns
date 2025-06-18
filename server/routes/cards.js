const express = require('express');
const router = express.Router();
const Card = require('../models/Card');
const auth = require('../middleware/auth');

// Get all cards
router.get('/', auth, async (req, res) => {
  try {
    const cards = await Card.find({ isActive: true });
    res.json(cards);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cards', error: error.message });
  }
});

// Add new card (admin only)
router.post('/', auth, async (req, res) => {
  try {
    const { id, name, type, effect, quantity, attributes, image } = req.body;
    
    const card = new Card({
      id,
      name,
      type,
      effect,
      quantity,
      attributes,
      image
    });

    await card.save();
    res.status(201).json({ message: 'Card added successfully', card });
  } catch (error) {
    res.status(500).json({ message: 'Error adding card', error: error.message });
  }
});

// Update card (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const card = await Card.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ message: 'Card updated successfully', card });
  } catch (error) {
    res.status(500).json({ message: 'Error updating card', error: error.message });
  }
});

// Toggle card activation (admin only)
router.put('/:id/activate', auth, async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    card.isActive = !card.isActive;
    await card.save();

    res.json({ message: `Card ${card.isActive ? 'activated' : 'deactivated'}` });
  } catch (error) {
    res.status(500).json({ message: 'Error toggling card activation', error: error.message });
  }
});

module.exports = router;
