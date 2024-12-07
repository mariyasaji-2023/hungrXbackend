const userModel = require('../models/userModel')
const mongoose = require ('mongoose')
const { getDBInstance } = require('../config/db');


const { MongoClient } = require("mongodb");
const { ObjectId } = require('mongodb');
const client = new MongoClient("mongodb+srv://hungrx001:b19cQlcRApahiWUD@cluster0.ynchc4e.mongodb.net/hungerX");

const profileScreen = async (req, res) => {
    const { userId } = req.body;
    try {
        const user = await userModel.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'user is not exist'
            });
        }

        // Create response object with formatted values and units
        const userProfile = {
            name: user.name || null,
            email: user.email || null,
            gender: user.gender || null,
            phone :user.mobile|| null,
            age: user.age ? `${user.age} years` : null,
            heightInCm: user.heightInCm ? `${user.heightInCm} cm` : null,
            weightInKg: user.weightInKg ? `${user.weightInKg} kg` : null,
            targetWeight: user.targetWeight ? `${user.targetWeight} kg` : null,
            // BMI: user.BMI || null,
            // BMR: user.BMR ? `${user.BMR} kcal/day` : null,
            // TDEE: user.TDEE ? `${user.TDEE} kcal/day` : null,
            dailyCalorieGoal: user.dailyCalorieGoal ? `${user.dailyCalorieGoal} kcal/day` : null,
            daysToReachGoal: user.daysToReachGoal ? `${user.daysToReachGoal} days` : null,
            caloriesToReachGoal: user.caloriesToReachGoal ? `${user.caloriesToReachGoal} kcal` : null,
            activityLevel: user.activityLevel || null,
            goal: user.goal || null,
            mealsPerDay: user.mealsPerDay || null,
            weightGainRate: user.weightGainRate ? `${user.weightGainRate} kg/week` : null,
            isMetric: user.isMetric || false,
            isVerified: user.isVerified || false
        };

        return res.status(200).json({
            status: true,
            data: userProfile
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {profileScreen}