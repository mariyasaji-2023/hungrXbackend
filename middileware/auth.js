// middleware/auth.js
const mongoose = require('mongoose');
const User = require('../models/userModel');

module.exports = async (req, res, next) => {
  try {
    // Get user ID from headers, query, or body
    const userId = req.body.userId; // Changed from req.body to req.body.userId
    
    if (!userId) {
      return res.status(401).json({ message: 'User ID required' });
    }
    
    // Validate MongoDB ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Set user on request object
    req.user = {
      id: user._id,
      email: user.email,
      platform: user.platform || 'unknown'
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: 'Authentication error' });
  }
};