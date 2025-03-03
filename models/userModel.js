const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    mobile: {
        type: String,
        unique: true,
        sparse: true,
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
    },
    password: {
        type: String,
        minlength: 6,
    },
    otp: {
        type: String,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    name: {
        type: String,
    },
    gender: {
        type: String,
        enum: ['male', 'female'],
    },
    heightInFeet: {
        type: Number
    },
    heightInInches: {
        type: Number
    },
    heightInCm: {
        type: Number
    },
    isMetric: {
        type: Boolean,
        default: false
    },
    weightInKg: {
        type: Number
    },
    weightInLbs: {
        type: Number
    },
    googleId: {
        type: String,
        sparse: true,
        unique: true,
        default: undefined
    },
    mealsPerDay: {
        type: Number,
        enum: [1, 2, 3, 4]
    },
    goal: {
        type: String,
        enum: ['lose weight', 'maintain weight', 'gain weight'],
    },
    targetWeight: {
        type: String,
    },
    weightGainRate: {
        type: Number,
        enum: [0.25, 0.50, 0.75, 1],
    },
    activityLevel: {
        type: String,
        enum: ['sedentary', 'lightly active', 'moderately active', 'very active', 'extra active'],
    },
    age: {
        type: Number
    },
    BMI: {
        type: String,
        required: false
    },
    BMR: {
        type: String,
        required: false
    },
    TDEE: {
        type: String,
        required: false
    },
    dailyCalorieGoal: {
        type: String,
        required: false
    },
    caloriesToReachGoal: {
        type: String,
        required: false
    },
    daysToReachGoal: {
        type: Number,
        required: false
    },
    profilePhoto: {
        type: String
    },
    mobile: {
        type: String
    },
    calculationDate: {
        type: String,
        match: /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/\d{4}$/ // Validates DD/MM/YYYY format
    },
    dailyWaterIntake: {
        type: String
    },
    waterIntakeHistory: {
        type: Map,
        of: {
            totalIntake: { type: Number, default: 0 },
            entries: [
                {
                    amount: { type: Number },
                    timestamp: { type: Date },
                },
            ],
            remaining: { type: Number },
        },
        default: new Map(),
    },
    dailyConsumptionStats: {
        type: Map,
        of: Number,
        default: new Map()
    }, appleId: {
        type: String,
        unique: true
    },
    appleEmail: {
        type: String,
        sparse: true
    },
    timezone: {
        type: String,
        enum: [
            "America/New_York",     // Eastern Time
            "America/Chicago",      // Central Time
            "America/Denver",       // Mountain Time
            "America/Los_Angeles",  // Pacific Time
            "America/Anchorage",    // Alaska Time
            "Pacific/Honolulu",     // Hawaii Time
            "America/Phoenix",      // Arizona Time (no DST)
            "America/Puerto_Rico",  // Atlantic Time
            "Pacific/Guam",  // Guam Time
            "Asia/Kolkata"         // Indian Standard Time (IST)
        ],
        default: "America/New_York" // Default timezone
    },
    subscription: {
        isSubscribed: { type: Boolean, default: false },
        rcAppUserId: { type: String },
        rcAppUserAliases: { type: [String], default: [] }, // Add this line to store all aliases
        purchaseToken: { type: String },
        productId: { type: String },
        subscriptionLevel: {
            type: String,
            enum: ['trial', 'monthly', 'annual', 'weekly', 'none']
        },
        expirationDate: { type: Date },
        lastVerified: { type: Date },
        purchaseHistory: [{
            productId: { type: String },
            purchaseDate: { type: Date },
            transactionId: { type: String },
            offerType: { type: String },
            priceInLocalCurrency: { type: String },
            currencyCode: { type: String }
        }]
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
