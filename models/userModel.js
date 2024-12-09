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
        // required:true
    },
    gender: {
        type: String,
        enum: ['male', 'female'],
        // required:true
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
    // uid: {
    //     type: String,
    //     unique: false
    // },
    // googleId: {
    //     type: String,
    //     unique: true
    // },
    googleId: {
        type: String,
        sparse: true,  // This allows null/undefined values and only creates indices for non-null values
        unique: true ,  // Only enforced on non-null values due to sparse index
        default: undefined
    },
    mealsPerDay: {
        type: Number,
        enum: [1, 2, 3, 4]
    },
    goal: {
        type: String,
        enum: ['lose weight', 'maintain weight', 'gain weight'],
        // required:true
    },
    targetWeight: {
        type: String,
        // required:true
    },
    weightGainRate: {
        type: Number,
        enum: [0.25, 0.50, 0.75, 1],
        // required:true
    },
    activityLevel: {
        type: String,
        enum: ['sedentary', 'lightly active', 'moderately active', 'very active', 'extra active'],
        // required:true
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
    profilePhoto:{
        type:String
    },
    mobile:{
        type:String
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
