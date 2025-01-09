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
    dailyWaterIntake:{
        type:String
    },
    dailyConsumptionStats: {
        type: Map,
        of: Number,
        default: new Map()
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
