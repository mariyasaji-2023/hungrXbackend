const axios = require('axios');
const User = require('../models/userModel'); // Path to your user model
require('dotenv').config();

// RevenueCat API configuration
const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY;
const REVENUECAT_BASE_URL = 'https://api.revenuecat.com/v1';
/**
 * Updates a user's subscription information
 * @param {string} userId - The user's MongoDB ID
 * @param {Object} subscriptionData - Subscription details to update
 * @returns {Promise<Object>} - Updated user object
 */
const updateUserSubscription = async (userId, subscriptionData) => {
  try {
    const {
      rcAppUserId,
      aliases = [], // Get aliases if provided
      purchaseToken,
      isSubscribed,
      productId,
      subscriptionLevel,
      expirationDate,
      transactionId,
      offerType,
      priceInLocalCurrency,
      currencyCode
    } = subscriptionData;

    // Create a subscription history entry if applicable
    const purchaseHistoryEntry = transactionId ? {
      productId,
      purchaseDate: new Date(),
      transactionId,
      offerType,
      priceInLocalCurrency,
      currencyCode
    } : null;

    // Update user subscription info
    const updateData = {
      'subscription.isSubscribed': isSubscribed,
      'subscription.lastVerified': new Date()
    };

    // Only update fields that are provided
    if (rcAppUserId) updateData['subscription.rcAppUserId'] = rcAppUserId;
    if (aliases && aliases.length > 0) updateData['subscription.rcAppUserAliases'] = aliases;
    if (purchaseToken) updateData['subscription.purchaseToken'] = purchaseToken;
    if (productId) updateData['subscription.productId'] = productId;
    if (subscriptionLevel) updateData['subscription.subscriptionLevel'] = subscriptionLevel;
    if (expirationDate) updateData['subscription.expirationDate'] = new Date(expirationDate);

    // Create the update operation
    const updateOperation = {
      $set: updateData
    };

    // Add to purchase history if we have transaction details
    if (purchaseHistoryEntry) {
      // Check if this transaction ID is already in purchase history
      const user = await User.findById(userId);
      const transactionExists = user?.subscription?.purchaseHistory?.some(
        entry => entry.transactionId === transactionId
      );
      
      // Only add to history if it's a new transaction
      if (!transactionExists && transactionId) {
        updateOperation.$push = {
          'subscription.purchaseHistory': purchaseHistoryEntry
        };
      }
    }

    // Find and update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateOperation,
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found`);
    }

    return updatedUser;
  } catch (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }
};


/**
 * Verifies subscription status with RevenueCat API
 * @param {string} rcAppUserId - RevenueCat App User ID
 * @returns {Promise<Object>} - Subscription details
 */
const verifyWithRevenueCat = async (rcAppUserId) => {
  try {
    if (!rcAppUserId) {
      throw new Error('Missing RevenueCat App User ID');
    }
    
    const response = await axios.get(
      `${REVENUECAT_BASE_URL}/subscribers/${rcAppUserId}`,
      {
        headers: {
          'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const customerInfo = response.data.subscriber;
    
    // Check if the user has any active entitlements
    const hasActiveEntitlement = 
      customerInfo.entitlements && 
      Object.keys(customerInfo.entitlements).length > 0 &&
      Object.values(customerInfo.entitlements).some(entitlement => entitlement.active);
    
    // Get subscription details
    let subscriptionDetails = {
      isSubscribed: hasActiveEntitlement,
      expirationDate: null,
      productId: null,
      subscriptionLevel: 'none',
      transactionId: null, 
      priceInLocalCurrency: null,
      currencyCode: null,
      aliases: customerInfo.aliases || [] // Store aliases from RevenueCat response
    };
    
    // If subscribed, extract more details
    if (hasActiveEntitlement) {
      // Get the first active entitlement
      const activeEntitlement = Object.values(customerInfo.entitlements).find(e => e.active);
      
      // Extract product ID from active subscription
      const productId = activeEntitlement?.product_identifier;
      
      // Get the latest transaction for this product
      const subscription = customerInfo.subscriptions?.[productId];
      const transactionId = subscription?.purchase_id || subscription?.original_purchase_id;
      
      // Extract price information if available
      const priceInLocalCurrency = subscription?.price || null;
      const currencyCode = subscription?.currency || null;
      
      // Determine subscription level from product ID
      let subscriptionLevel = 'none';
      if (productId) {
        if (productId.includes('trial')) subscriptionLevel = 'trial';
        else if (productId.includes('annual')) subscriptionLevel = 'annual';
        else if (productId.includes('monthly')) subscriptionLevel = 'monthly';
        else if (productId.includes('weekly')) subscriptionLevel = 'weekly';
      }
      
      // Get expiration date
      const expirationDate = activeEntitlement?.expires_date;
      
      subscriptionDetails = {
        isSubscribed: true,
        expirationDate,
        productId,
        subscriptionLevel,
        transactionId,
        priceInLocalCurrency,
        currencyCode,
        aliases: customerInfo.aliases || []
      };
    }
    
    return subscriptionDetails;
  } catch (error) {
    console.error('Error verifying with RevenueCat:', error);
    throw error;
  }
};


/**
 * Processes webhook events from RevenueCat
 * @param {Object} webhookData - RevenueCat webhook data
 * @returns {Promise<Object>} - Processing result
 */
const processRevenueCatWebhook = async (webhookData) => {
  if (!webhookData || !webhookData.event) {
    throw new Error('Missing webhook event data');
  }

  const { event } = webhookData;

  try {
    // Extract the relevant information from the event
    const {
      event_type,
      app_user_id,
      aliases = [], // Get the aliases array (default to empty if not provided)
      product_id,
      purchase_date,
      expiration_date,
      transaction_id,
      price,
      currency
    } = event;

    // Create an array of all possible IDs to check (main ID + all aliases)
    const allPossibleIds = [app_user_id, ...aliases].filter(Boolean);

    // Find the user with any of these RevenueCat App User IDs
    const user = await User.findOne({ 
      'subscription.rcAppUserId': { $in: allPossibleIds } 
    });

    if (!user) {
      console.warn(`No user found with RevenueCat App User ID: ${app_user_id} or any of its aliases`);
      return { 
        success: false, 
        message: 'User not found' 
      };
    }

    // Determine the subscription status based on the event type
    let isSubscribed = false;
    let subscriptionLevel = 'none';

    switch (event_type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
      case 'TRIAL_STARTED':
        isSubscribed = true;
        // Determine subscription level from product ID
        if (product_id.includes('trial')) subscriptionLevel = 'trial';
        else if (product_id.includes('annual')) subscriptionLevel = 'annual';
        else if (product_id.includes('monthly')) subscriptionLevel = 'monthly';
        else if (product_id.includes('weekly')) subscriptionLevel = 'weekly';
        break;
      
      case 'CANCELLATION':
      case 'EXPIRATION':
      case 'BILLING_ISSUE':
        isSubscribed = false;
        subscriptionLevel = 'none';
        break;
    }

    // Update the user's subscription information
    const subscriptionData = {
      rcAppUserId: app_user_id,
      isSubscribed,
      productId: product_id,
      subscriptionLevel,
      expirationDate: expiration_date,
      transactionId: transaction_id,
      priceInLocalCurrency: price,
      currencyCode: currency
    };

    const updatedUser = await updateUserSubscription(user._id, subscriptionData);

    return {
      success: true,
      userId: user._id,
      isSubscribed,
      subscriptionLevel
    };
  } catch (error) {
    console.error('Error processing RevenueCat webhook:', error);
    throw error;
  }
};


/**
 * Verifies a user's subscription status
 * @param {string} userId - The user's MongoDB ID
 * @returns {Promise<Object>} - Subscription status details
 */
const verifyUserSubscription = async (userId) => {
  try {
    // Find the user
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Check if we have a RevenueCat App User ID
    if (!user.subscription?.rcAppUserId) {
      return {
        isSubscribed: false,
        subscriptionLevel: 'none',
        fromCache: false
      };
    }
    
    // If the subscription was recently verified (within the last hour), use the cached value
    const lastVerified = user.subscription?.lastVerified;
    const isRecentlyVerified = lastVerified && 
      (new Date() - new Date(lastVerified)) < (60 * 60 * 1000); // 1 hour in milliseconds
    
    if (isRecentlyVerified) {
      return {
        isSubscribed: user.subscription.isSubscribed,
        subscriptionLevel: user.subscription.subscriptionLevel,
        expirationDate: user.subscription.expirationDate,
        fromCache: true
      };
    }
    
    // Otherwise, verify with RevenueCat
    const subscriptionDetails = await verifyWithRevenueCat(user.subscription.rcAppUserId);
    
    // Update the user's subscription information
    await updateUserSubscription(userId, {
      ...subscriptionDetails,
      rcAppUserId: user.subscription.rcAppUserId
    });
    
    return { 
      ...subscriptionDetails, 
      fromCache: false 
    };
  } catch (error) {
    console.error('Error verifying user subscription:', error);
    throw error;
  }
};

/**
 * Stores initial subscription information during purchase
 * @param {string} userId - The user's MongoDB ID
 * @param {Object} subscriptionInfo - Initial subscription details
 * @returns {Promise<Object>} - Updated user object
 */
const storeInitialSubscription = async (userId, subscriptionInfo) => {
  try {
    if (!userId || !subscriptionInfo) {
      throw new Error('Missing required parameters: userId and subscriptionInfo are required');
    }

    const {
      rcAppUserId,
      purchaseToken,
      productId,
      transactionId,
      offerType,
      priceInLocalCurrency,
      currencyCode
    } = subscriptionInfo;
    
    // Validate required subscription info fields
    if (!rcAppUserId || !productId) {
      throw new Error('Missing required subscription information: rcAppUserId and productId are required');
    }
    
    // Determine subscription level from product ID
    let subscriptionLevel = 'none';
    if (productId) {
      if (productId.includes('trial')) subscriptionLevel = 'trial';
      else if (productId.includes('annual')) subscriptionLevel = 'annual';
      else if (productId.includes('monthly')) subscriptionLevel = 'monthly';
      else if (productId.includes('weekly')) subscriptionLevel = 'weekly';
    }
    
    // Prepare subscription data
    const subscriptionData = {
      rcAppUserId,
      purchaseToken,
      isSubscribed: true,
      productId,
      subscriptionLevel,
      expirationDate: null, // Will be updated after verification
      transactionId,
      offerType,
      priceInLocalCurrency,
      currencyCode
    };
    
    // Update the user with initial subscription data
    const updatedUser = await updateUserSubscription(userId, subscriptionData);
    
    // Verify with RevenueCat to get complete details
    try {
      const verificationDetails = await verifyWithRevenueCat(rcAppUserId);
      
      // Update with verified details if successful
      if (verificationDetails.isSubscribed) {
        await updateUserSubscription(userId, {
          ...verificationDetails,
          rcAppUserId
        });
      }
    } catch (verificationError) {
      console.error('Error verifying with RevenueCat after initial storage:', verificationError);
      // Continue with the initial subscription data even if verification fails
    }
    
    return updatedUser;
  } catch (error) {
    console.error('Error storing initial subscription:', error);
    throw error;
  }
};

module.exports = {
  updateUserSubscription,
  verifyWithRevenueCat,
  processRevenueCatWebhook,
  verifyUserSubscription,
  storeInitialSubscription
};