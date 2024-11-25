// models/WaterTracker.js

const mongoose = require('mongoose');

const waterTrackerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    targetWaterIntake: {
        type: Number,  // in liters
        required: true
    },
    waterConsumed: {
        type: Number,  // in liters
        default: 0
    },
    waterLog: [{
        amount: Number,  // in liters
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

// Add index for efficient querying
waterTrackerSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('WaterTracker', waterTrackerSchema);