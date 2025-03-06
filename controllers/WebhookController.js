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
    const currentDate = req.body.currentDate || new Date().toISOString(); // Get current date from request or use server date
    
    const subscriptionStatus = await subscriptionService.verifyUserSubscription(userId, currentDate);
    
    return res.json({
      success: true,
      userId: req.user.id,
      rcAppUserId: subscriptionStatus.rcAppUserId,
      productId: subscriptionStatus.productId,
      isSubscribed: subscriptionStatus.isSubscribed,
      subscriptionLevel: subscriptionStatus.subscriptionLevel,
      expirationDate: subscriptionStatus.expirationDate,
      isValid: subscriptionStatus.isValid,
      fromCache: subscriptionStatus.fromCache,
      revenuecatDetails: {
        isCanceled: subscriptionStatus.revenuecatDetails?.isCanceled || false,
        expirationDate: subscriptionStatus.revenuecatDetails?.expirationDate || null,
        productIdentifier: subscriptionStatus.revenuecatDetails?.productIdentifier || null,
        periodType: subscriptionStatus.revenuecatDetails?.periodType || null,
        latestPurchaseDate: subscriptionStatus.revenuecatDetails?.latestPurchaseDate || null,
        originalPurchaseDate: subscriptionStatus.revenuecatDetails?.originalPurchaseDate || null,
        store: subscriptionStatus.revenuecatDetails?.store || null,
        isSandbox: subscriptionStatus.revenuecatDetails?.isSandbox || false,
        willRenew: subscriptionStatus.revenuecatDetails?.willRenew || false
      }
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

const store = async (req, res) => {
  try {
    const userId = req.user.id;
    const subscriptionInfo = req.body;
    
    const rcAppUserId = subscriptionInfo.rcAppUserId;
    const isUpdate = subscriptionInfo.isUpdate || false;
    
    if (!subscriptionInfo.productId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required product ID'
      });
    }
    
    const revenuecatDetails = subscriptionInfo.revenuecatDetails || {};
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Handle update case
    if (isUpdate === true) {
      // Check if user has existing rcAppUserId in their subscription
      if (user.subscription?.rcAppUserId) {
        // Update subscription details for the existing user
        const updatedUser = await subscriptionService.storeInitialSubscription(
          userId, 
          { 
            ...subscriptionInfo,
            revenuecatDetails 
          }
        );
        
        return res.json({
          success: true,
          message: 'Subscription information updated successfully for existing user',
          isSubscribed: updatedUser.subscription.isSubscribed,
          subscriptionLevel: updatedUser.subscription.subscriptionLevel,
          revenuecatDetails: updatedUser.revenuecatDetails
        });
      } else {
        // Don't update if rcAppUserId doesn't exist in user's subscription
        return res.status(400).json({
          success: false,
          message: 'Cannot update: User does not have an existing RevenueCat App User ID'
        });
      }
    } 
    // Handle non-update cases (original logic)
    else {
      // Case 1: If userId is present and user doesn't have RevenueCat ID
      if (userId && !user.subscription?.rcAppUserId) {
        const updatedUser = await subscriptionService.storeInitialSubscription(
          userId, 
          { 
            ...subscriptionInfo,
            revenuecatDetails 
          }
        );
        
        return res.json({
          success: true,
          message: 'Initial subscription information stored successfully',
          isSubscribed: updatedUser.subscription.isSubscribed,
          subscriptionLevel: updatedUser.subscription.subscriptionLevel,
          revenuecatDetails: updatedUser.revenuecatDetails
        });
      }
      
      // Case 2: If both userId and rcAppUserId are present
      if (userId && rcAppUserId) {
        const userRcId = user.subscription?.rcAppUserId;
        const userAliases = user.subscription?.rcAppUserAliases || [];
        
        if (userRcId === rcAppUserId || userAliases.includes(rcAppUserId)) {
          const updatedUser = await subscriptionService.storeInitialSubscription(
            userId, 
            { 
              ...subscriptionInfo, 
              revenuecatDetails 
            }
          );
          
          return res.json({
            success: true,
            message: 'Subscription information updated successfully for matching user',
            isSubscribed: updatedUser.subscription.isSubscribed,
            subscriptionLevel: updatedUser.subscription.subscriptionLevel,
            revenuecatDetails: updatedUser.revenuecatDetails
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'The provided RevenueCat App User ID does not match the user\'s ID or aliases'
          });
        }
      }
      
      return res.status(400).json({
        success: false,
        message: 'Invalid combination of userId and rcAppUserId'
      });
    }
    
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
    // Log received data for debugging
    console.log('Webhook request body:', JSON.stringify(req.body, null, 2));
    
    // Verify webhook signature if RevenueCat provides one
    // const signature = req.headers['x-webhook-signature'];
    // if (!verifyWebhookSignature(signature, req.body)) {
    //   return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    // }
    
    // Pass req.body instead of the whole req object
    const result = await subscriptionService.processRevenueCatWebhook(req.body);
    
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