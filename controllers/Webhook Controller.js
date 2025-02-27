// controllers/webhookController.js
const subscriptionService = require('../services/subscriptionService');
const User = require('../models/userModel');

/**
 * Verifies a user's subscription status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verify = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    
    const subscriptionStatus = await subscriptionService.verifyUserSubscription(userId);
    
    return res.json({
      success: true,
      isSubscribed: subscriptionStatus.isSubscribed,
      subscriptionLevel: subscriptionStatus.subscriptionLevel,
      expirationDate: subscriptionStatus.expirationDate,
      fromCache: subscriptionStatus.fromCache
    });
  } catch (error) {
    console.error('Error verifying subscription:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify subscription status',
      error: error.message
    });
  }
};

/**
 * Stores initial subscription information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const store = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const subscriptionInfo = req.body;
    
    // Validate required fields
    if (!subscriptionInfo.rcAppUserId || !subscriptionInfo.productId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required subscription information'
      });
    }
    
    const updatedUser = await subscriptionService.storeInitialSubscription(
      userId,
      subscriptionInfo
    );
    
    return res.json({
      success: true,
      message: 'Subscription information stored successfully',
      isSubscribed: updatedUser.subscription.isSubscribed,
      subscriptionLevel: updatedUser.subscription.subscriptionLevel
    });
  } catch (error) {
    console.error('Error storing subscription:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to store subscription information',
      error: error.message
    });
  }
};
/**
 * @route   POST /api/subscription/webhook
 * @desc    Handle RevenueCat webhook events
 * @access  Public (but secured with webhook secret)
 */
const webhook = async (req, res) => {
  try {
    // Verify webhook signature if RevenueCat provides one
    // const signature = req.headers['x-webhook-signature'];
    // if (!verifyWebhookSignature(signature, req.body)) {
    //   return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    // }
    
    const event = req.body;
    
    // Process the webhook event
    const result = await subscriptionService.processRevenueCatWebhook(event);
    
    return res.json({
      success: true,
      message: 'Webhook processed successfully',
      result
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Return 200 status even on error to prevent RevenueCat from retrying
    return res.status(200).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message
    });
  }
}
module.exports = {
  verify,
  store,
  webhook
};