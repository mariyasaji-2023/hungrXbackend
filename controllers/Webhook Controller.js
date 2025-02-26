// controllers/webhookController.js
const subscriptionService = require('../services/subscriptionService');
const User = require('../models/userModel');

const handleRevenueCatWebhook = async (req, res) => {
  try {
    const eventData = req.body;
    console.log('RevenueCat webhook received:', JSON.stringify(eventData, null, 2));
    
    if (!eventData || !eventData.event || !eventData.app_user_id) {
      return res.status(400).json({ message: 'Invalid webhook data' });
    }

    // Process the webhook event - pass the full eventData object
    await subscriptionService.processWebhook(eventData);
    
    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const registerUser = async (req, res) => {
  try {
    const { email, name, revenueCatId, platform, deviceId } = req.body;
    
    if (!email || !revenueCatId || !platform) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (user) {
      // Update existing user
      user.revenueCatId = revenueCatId;
      user.platform = platform;
      if (deviceId) user.deviceId = deviceId;
      await user.save();
    } else {
      // Create new user
      user = new User({
        email,
        name: name || email.split('@')[0],
        revenueCatId,
        platform,
        deviceId
      });
      await user.save();
    }
    
    return res.status(200).json({ 
      success: true, 
      userId: user._id,
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Updated function to retrieve subscription status
const getUserSubscription = async (req, res) => {
    try {
      // Get user ID from req.user set by auth middleware
      const userId = req.user.id; // Changed to use req.user.id instead of req.body.userId
      
      // Get subscription status
      const subscriptionStatus = await subscriptionService.getUserSubscriptionStatus(userId);
      
      return res.status(200).json(subscriptionStatus);
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      return res.status(500).json({ 
        message: 'Internal server error',
        hasActiveSubscription: false 
      });
    }
  };
  
module.exports = {
  handleRevenueCatWebhook,
  registerUser,
  getUserSubscription
};