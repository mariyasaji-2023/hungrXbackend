const mongoose = require('mongoose');

const deletedUserSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    mobile: String,
    email: String,
    password: String,
    otp: String,
    isVerified: Boolean,
    name: String,
    gender: {
        type: String,
        enum: ['male', 'female'],
    },
    heightInFeet: Number,
    heightInInches: Number,
    heightInCm: Number,
    isMetric: Boolean,
    weightInKg: Number,
    weightInLbs: Number,
    googleId: String,
    mealsPerDay: {
        type: Number,
        enum: [1, 2, 3, 4]
    },
    goal: {
        type: String,
        enum: ['lose weight', 'maintain weight', 'gain weight'],
    },
    targetWeight: String,
    weightGainRate: {
        type: Number,
        enum: [0.25, 0.50, 0.75, 1]
    },
    activityLevel: {
        type: String,
        enum: ['sedentary', 'lightly active', 'moderately active', 'very active', 'extra active'],
    },
    age: Number,
    BMI: String,
    BMR: String,
    TDEE: String,
    dailyCalorieGoal: String,
    caloriesToReachGoal: String,
    daysToReachGoal: Number,
    profilePhoto: String,
    deletedAt: {
        type: Date,
        default: Date.now,
    },
});

const DeletedUser = mongoose.model('DeletedUser', deletedUserSchema);
module.exports = DeletedUser;
