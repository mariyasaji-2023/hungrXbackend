const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    mobile: {
        type: String,
        unique: true,
        sparse: true, // Allows either mobile or email to be empty
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
    },
    password: {
        type: String,
        minlength: 6, // Set a minimum length for security
    },
    otp: {
        type: String, // Store OTP temporarily
    },
    isVerified: {
        type: Boolean,
        default: false, // User is not verified until they enter correct OTP
    }, 
    name: {
        type: String,
    },
    gender: {
        type: String,
        enum: ['male', 'female']
    },
    height: {
        type: String,
    },
    weight: {
        type: String,
    },
    uid: {
        type: String,
        unique: true
    },
    googleId: {
        type: String,
        unique: true
    },
    mealsPerDay: {
        type: Number,
        enum: [1, 2, 3, 4]
    },
    goal: {
        type: String,
        enum: ['lose weight', 'maintain weight', 'gain weight']
    },
    targetWeight: {
        type: String
    },
    weightGainRate: {
        type: String,
        enum: ['mild', 'moderate', 'fast', 'very fast']
    }, activityLevel: {
        type: String,
        enum: ['sedentary', 'lightly active', 'moderately active', 'very active', 'extra active']
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
