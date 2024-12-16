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
        type: Number,
        required: true
    },
    waterConsumed: {
        type: Number,
        default: 0
    },
    waterLog: [{
        amount: Number,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

waterTrackerSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('WaterTracker', waterTrackerSchema);