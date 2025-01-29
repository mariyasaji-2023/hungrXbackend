const mongoose = require('mongoose');

const WeightSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    weight: {
        type: Number,
        required: true
    },
    weightHistory: [{
        weight: Number,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Weight', WeightSchema);