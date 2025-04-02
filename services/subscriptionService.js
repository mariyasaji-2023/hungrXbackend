const axios = require('axios');
const User = require('../models/userModel'); // Path to your user model
require('dotenv').config();

// RevenueCat API configuration
const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY;
const REVENUECAT_BASE_URL = 'https://api.revenuecat.com/v1';
/**
 * Updates a user's subscription information
 * @param {string} userId - The user's MongoDB ID
 * @param {Object} subscriptionDetails - Details from RevenueCat
 * @returns {Promise<Object>} - Updated user object
 */
const updateUserSubscription = async (userId, subscriptionDetails) => {
  try {
    const {
      isSubscribed,
      subscriptionLevel,
      expirationDate,
      rcAppUserId,
      isValid,
      revenuecatDetails
    } = subscriptionDetails;

    const updateFields = {
      'subscription.isSubscribed': isSubscribed,
      'subscription.subscriptionLevel': subscriptionLevel,
      'subscription.expirationDate': expirationDate,
      'subscription.lastVerified': new Date(),
      'isValid': isValid
    };

    // Only update revenuecatDetails if provided
    if (revenuecatDetails) {
      updateFields.revenuecatDetails = revenuecatDetails;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
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
 * @param {string} currentDate - Current date in ISO format
 * @returns {Promise<Object>} - Subscription status details
 */
const verifyUserSubscription = async (userId, currentDate) => {
  try {
    // Find the user
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Check if we have an expiration date but no RevenueCat App User ID
    if (!user.subscription?.rcAppUserId && user.revenuecatDetails?.expirationDate) {
      console.log('workinggggggggggggggggggggg');

      const currentDateTime = new Date(currentDate);
      const expirationDate = new Date(user.revenuecatDetails.expirationDate);
      const isValid = currentDateTime < expirationDate;
      // Return with isValid true and the existing expiration date
      return {
        userId: userId,
        rcAppUserId: null,
        productId: user.subscription?.productId || null,
        isSubscribed: user.subscription?.isSubscribed || false, 
        subscriptionLevel: user.subscription?.subscriptionLevel || 'premium',
        expirationDate: user.subscription.expirationDate,
        isValid: isValid,
        fromCache: false,
        revenuecatDetails: {
          isCanceled: user.revenuecatDetails?.isCanceled || false,
          expirationDate: user.revenuecatDetails?.expirationDate || null,
          productIdentifier: user.revenuecatDetails?.productIdentifier || null,
          periodType: user.revenuecatDetails?.periodType || null,
          latestPurchaseDate: user.revenuecatDetails?.latestPurchaseDate || null,
          originalPurchaseDate: user.revenuecatDetails?.originalPurchaseDate || null,
          store: user.revenuecatDetails?.store || null,
          isSandbox: user.revenuecatDetails?.isSandbox || false,
          willRenew: user.revenuecatDetails?.willRenew || false
        }
      };
    }
    
    // Check if we have a RevenueCat App User ID
    if (!user.subscription?.rcAppUserId) {      
      return {
        userId: userId,
        rcAppUserId: null,
        productId: null,
        isSubscribed: false,
        subscriptionLevel: 'none',
        expirationDate: null,
        isValid: false,
        fromCache: false,
        revenuecatDetails: {
          isCanceled: false,
          expirationDate: null,
          productIdentifier: null,
          periodType: null,
          latestPurchaseDate: null,
          originalPurchaseDate: null,
          store: null,
          isSandbox: false,
          willRenew: false
        }
      };
    }
    
    const currentDateTime = new Date(currentDate);
    let isValid = false;
    
    // Check if subscription is valid based on expiration date
    if (user.subscription.expirationDate) {
      const expirationDate = new Date(user.subscription.expirationDate);
      isValid = currentDateTime < expirationDate;
    }
    
    // Update the isValid field in the database
    await User.findByIdAndUpdate(userId, { 
      $set: { isValid: isValid }
    });
    
    // If the subscription was recently verified (within the last hour), use the cached value
    const lastVerified = user.subscription?.lastVerified;
    const isRecentlyVerified = lastVerified && 
      (new Date() - new Date(lastVerified)) < (60 * 60 * 1000); // 1 hour in milliseconds
    
    if (isRecentlyVerified) {
      return {
        userId: userId,
        rcAppUserId: user.subscription.rcAppUserId,
        productId: user.subscription.productId,
        isSubscribed: user.subscription.isSubscribed,
        subscriptionLevel: user.subscription.subscriptionLevel,
        expirationDate: user.subscription.expirationDate,
        isValid: isValid,
        fromCache: true,
        revenuecatDetails: {
          isCanceled: user.revenuecatDetails?.isCanceled || false,
          expirationDate: user.revenuecatDetails?.expirationDate || null,
          productIdentifier: user.revenuecatDetails?.productIdentifier || null,
          periodType: user.revenuecatDetails?.periodType || null,
          latestPurchaseDate: user.revenuecatDetails?.latestPurchaseDate || null,
          originalPurchaseDate: user.revenuecatDetails?.originalPurchaseDate || null,
          store: user.revenuecatDetails?.store || null,
          isSandbox: user.revenuecatDetails?.isSandbox || false,
          willRenew: user.revenuecatDetails?.willRenew || false
        }
      };
    }
    
    // Otherwise, verify with RevenueCat
    const subscriptionDetails = await verifyWithRevenueCat(user.subscription.rcAppUserId);
    
    // Update the isValid based on the latest data
    if (subscriptionDetails.expirationDate) {
      const expirationDate = new Date(subscriptionDetails.expirationDate);
      isValid = currentDateTime < expirationDate;
    }
    
    // Update the user's subscription information
    await updateUserSubscription(userId, {
      ...subscriptionDetails,
      rcAppUserId: user.subscription.rcAppUserId,
      isValid: isValid
    });
    
    return { 
      userId: userId,
      rcAppUserId: user.subscription.rcAppUserId,
      productId: user.subscription.productId,
      ...subscriptionDetails, 
      isValid: isValid,
      fromCache: false,
      revenuecatDetails: {
        isCanceled: user.revenuecatDetails?.isCanceled || false,
        expirationDate: user.revenuecatDetails?.expirationDate || null,
        productIdentifier: user.revenuecatDetails?.productIdentifier || null,
        periodType: user.revenuecatDetails?.periodType || null,
        latestPurchaseDate: user.revenuecatDetails?.latestPurchaseDate || null,
        originalPurchaseDate: user.revenuecatDetails?.originalPurchaseDate || null,
        store: user.revenuecatDetails?.store || null,
        isSandbox: user.revenuecatDetails?.isSandbox || false,
        willRenew: user.revenuecatDetails?.willRenew || false
      }
    };
  } catch (error) {
    console.error('Error verifying user subscription:', error);
    throw error;
  }
};

/**
 * Store initial subscription information for a user
 * @param {string} userId - The user ID
 * @param {Object} subscriptionInfo - Subscription information from client
 * @returns {Promise<Object>} - Updated user object
 */
const storeInitialSubscription = async (userId, subscriptionInfo) => {
  try {
    const { 
      rcAppUserId, 
      productId, 
      subscriptionLevel, 
      expirationDate,
      revenuecatDetails // Extract RevenueCat details
    } = subscriptionInfo;

    // Find and update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'subscription.isSubscribed': true,
          'subscription.rcAppUserId': rcAppUserId,
          'subscription.productId': productId,
          'subscription.subscriptionLevel': subscriptionLevel || 'monthly',
          'subscription.expirationDate': expirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days
          'subscription.lastVerified': new Date(),
          'revenuecatDetails': revenuecatDetails // Add RevenueCat details to user document
        },
        $addToSet: {
          'subscription.rcAppUserAliases': rcAppUserId
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      throw new Error('User not found');
    }

    return updatedUser;
  } catch (error) {
    console.error('Error in storeInitialSubscription:', error);
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