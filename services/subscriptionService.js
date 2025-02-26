// services/subscriptionService.js
const User = require('../models/userModel');
const Subscription = require('../models/SubscriptionModel');

class SubscriptionService {
  constructor() {
    this.productMappings = {
      // iOS products
      ios: {
        'com.hungrx.premium.trial': 'trial',
        'com.hungrx.premium.monthly': 'monthly',
        'com.hungrx.premium.annual': 'annual'
      },
      // Android products
      android: {
        'com-hungrx-premium-trial': 'trial',
        'com-hungrx-premium-monthly': 'monthly',
        'com-hungrx-premium-annual': 'annual'
      }
    };
  }

  // Process webhook from RevenueCat
  async processWebhook(eventData) {
    try {
      // Extract properties directly from the eventData parameter
      const {
        event,
        product_id,
        app_user_id,
        store,
        expiration_at_ms,
        purchase_date_ms,
        original_transaction_id,
        transaction_id
      } = eventData;

      // Find the user by RevenueCat ID
      const user = await User.findOne({ revenueCatId: app_user_id });
      if (!user) {
        console.log(`User not found for RevenueCat ID: ${app_user_id}`);
        return null;
      }

      // Get platform (ios or android) based on store
      const platform = store === 'app_store' ? 'ios' : 'android';
      
      // Determine plan type from product_id
      const planType = this._getPlanType(product_id, platform);
      
      // Process based on event type
      switch (event) {
        case 'INITIAL_PURCHASE':
        case 'RENEWAL':
          return await this._handlePurchaseOrRenewal(
            user._id,
            eventData,
            platform,
            planType
          );
          
        case 'CANCELLATION':
          return await this._handleCancellation(user._id, eventData);
          
        case 'EXPIRATION':
          return await this._handleExpiration(user._id, eventData);
          
        default:
          console.log(`Unhandled event type: ${event}`);
          return null;
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      throw error;
    }
  }
  
  // Handle purchase or renewal events
  async _handlePurchaseOrRenewal(userId, eventData, platform, planType) {
    const {
      product_id,
      event,
      expiration_at_ms,
      purchase_date_ms,
      store,
      original_transaction_id,
      transaction_id,
    } = eventData;

    // Convert timestamps to Date objects
    const startDate = new Date(parseInt(purchase_date_ms));
    const expirationDate = new Date(parseInt(expiration_at_ms));
    
    // Check if subscription exists
    let subscription = await Subscription.findOne({ 
      userId, 
      originalTransactionId: original_transaction_id 
    });
    
    if (subscription) {
      // Update existing subscription
      subscription.status = planType === 'trial' ? 'in_trial' : 'active';
      subscription.latestTransactionId = transaction_id;
      subscription.expirationDate = expirationDate;
      subscription.isAutoRenewing = true;
      subscription.latestWebhookData = eventData;
    } else {
      // Create new subscription
      subscription = new Subscription({
        userId,
        status: planType === 'trial' ? 'in_trial' : 'active',
        productId: product_id,
        planType,
        store: store,
        originalTransactionId: original_transaction_id,
        latestTransactionId: transaction_id,
        startDate,
        expirationDate,
        isAutoRenewing: true,
        latestWebhookData: eventData
      });
    }
    
    await subscription.save();
    console.log(`Subscription ${event === 'INITIAL_PURCHASE' ? 'created' : 'renewed'} for user ${userId}`);
    
    return subscription;
  }
  
  // Handle cancellation events
  async _handleCancellation(userId, eventData) {
    const { original_transaction_id, transaction_id } = eventData;
    
    const subscription = await Subscription.findOne({ 
      userId, 
      originalTransactionId: original_transaction_id 
    });
    
    if (!subscription) {
      console.log(`Subscription not found for cancellation: ${original_transaction_id}`);
      return null;
    }
    
    // Update subscription
    subscription.status = 'canceled';
    subscription.isAutoRenewing = false;
    subscription.latestTransactionId = transaction_id || subscription.latestTransactionId;
    subscription.latestWebhookData = eventData;
    
    await subscription.save();
    console.log(`Subscription canceled for user ${userId}`);
    
    return subscription;
  }
  
  // Handle expiration events
  async _handleExpiration(userId, eventData) {
    const { original_transaction_id, transaction_id } = eventData;
    
    const subscription = await Subscription.findOne({ 
      userId, 
      originalTransactionId: original_transaction_id 
    });
    
    if (!subscription) {
      console.log(`Subscription not found for expiration: ${original_transaction_id}`);
      return null;
    }
    
    // Update subscription
    subscription.status = 'expired';
    subscription.isAutoRenewing = false;
    subscription.latestTransactionId = transaction_id || subscription.latestTransactionId;
    subscription.latestWebhookData = eventData;
    
    await subscription.save();
    console.log(`Subscription expired for user ${userId}`);
    
    return subscription;
  }
  
  // Get plan type from product ID based on platform
  _getPlanType(productId, platform) {
    // Get the mapping for the platform
    const mappings = this.productMappings[platform];
    if (!mappings) return 'unknown';
    
    // Return the plan type from the mapping or unknown
    return mappings[productId] || 'unknown';
  }
  
  // Get user's subscription status
  async getUserSubscriptionStatus(userId) {
    try {
      const subscription = await Subscription.findOne({ 
        userId, 
        status: { $in: ['active', 'in_trial'] },
        expirationDate: { $gt: new Date() }
      }).sort({ expirationDate: -1 });
      
      if (!subscription) {
        return {
          hasActiveSubscription: false,
          subscription: null
        };
      }
      
      return {
        hasActiveSubscription: true,
        subscription: {
          planType: subscription.planType,
          status: subscription.status,
          platform: subscription.store === 'app_store' ? 'ios' : 'android',
          expirationDate: subscription.expirationDate,
          isAutoRenewing: subscription.isAutoRenewing
        }
      };
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      throw error;
    }
  }
}

module.exports = new SubscriptionService();