// models/subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'expired', 'in_trial'],
    required: true
  },
  productId: {
    type: String,
    required: true
  },
  planType: {
    type: String,
    enum: ['monthly', 'annual', 'trial'],
    required: true
  },
  store: {
    type: String, 
    enum: ['app_store', 'play_store'],
    required: true
  },
  originalTransactionId: String,
  latestTransactionId: String,
  startDate: Date,
  expirationDate: Date,
  isAutoRenewing: {
    type: Boolean,
    default: true
  },
  latestWebhookData: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// Index for faster lookups
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ productId: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);