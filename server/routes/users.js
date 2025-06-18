const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { username, avatar },
      { new: true, runValidators: true }
    );
    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

// Get online users
router.get('/online', auth, async (req, res) => {
  try {
    const users = await User.find({ online: true }).select('username avatar');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching online users', error: error.message });
  }
});

// Update user status
router.put('/status', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { online: req.body.online },
      { new: true }
    );
    res.json({ message: 'Status updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
});

module.exports = router;
