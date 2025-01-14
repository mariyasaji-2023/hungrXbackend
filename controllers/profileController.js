const userModel = require('../models/userModel')
const deletedUserModel = require('../models/deletedUsersModel')
const mongoose = require('mongoose')
const { getDBInstance } = require('../config/db');


const { MongoClient } = require("mongodb");
const { ObjectId } = require('mongodb');
const client = new MongoClient(process.env.DB_URI);

const basicInfo = async (req, res) => {
    const { userId } = req.body;
    try {
        const user = await userModel.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User does not exist',
            });
        }
        const weightInKg = user.weightInKg ? `${user.weightInKg}` : null;
        const weightInLbs = user.weightInLbs ? `${user.weightInLbs}` : null;

        const heightInCm = user.heightInCm ? `${user.heightInCm}` : null;
        const heightInFeet = user.heightInFeet
            ? `${user.heightInFeet}`
            : null;
        const heightInInches = user.heightInInches
            ? `${user.heightInInches}`
            : null;
        const userProfile = {
            name: user.name || null,
            email: user.email || null,
            gender: user.gender || null,
            phone: user.mobile || null,
            age: user.age ? `${user.age}` : null,
            heightInCm,
            heightInFeet,
            heightInInches,
            weightInKg,
            weightInLbs,
            targetWeight: user.targetWeight ? `${user.targetWeight} kg` : null,
            dailyCalorieGoal: user.dailyCalorieGoal
                ? `${user.dailyCalorieGoal} kcal/day`
                : null,
            daysToReachGoal: user.daysToReachGoal
                ? `${user.daysToReachGoal} days`
                : null,
            caloriesToReachGoal: user.caloriesToReachGoal
                ? `${user.caloriesToReachGoal} kcal`
                : null,
            activityLevel: user.activityLevel || null,
            goal: user.goal || null,
            mealsPerDay: user.mealsPerDay || null,
            weightGainRate: user.weightGainRate
                ? `${user.weightGainRate} kg/week`
                : null,
            isMetric: user.isMetric || false,
            isVerified: user.isVerified || false,
        };

        return res.status(200).json({
            status: true,
            data: userProfile,
        });
    } catch (error) {
        console.error('Error in basicInfo:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};

const updateBasicInfo = async (req, res) => {
    const {
        userId,
        name,
        gender,
        mobile,
        email,
        age,
        weightInKg,
        weightInLbs,
        targetWeight,
        heightInCm,
        heightInFeet,
        heightInInches,
        goal,
        isMetric
    } = req.body;

    try {
        const user = await userModel.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User does not exist'
            });
        }
        if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid email format'
            });
        }

        // Create update object with only provided fields
        let updatedData = {};

        // Only add fields that are provided in the request
        if (name) updatedData.name = name;
        if (gender) updatedData.gender = gender;
        if (mobile) updatedData.mobile = mobile;
        if (email) updatedData.email = email;
        if (age) updatedData.age = age;
        if (goal) updatedData.goal = goal;
        if (typeof isMetric === 'boolean') updatedData.isMetric = isMetric;

        // Handle height based on metric preference
        if (isMetric && heightInCm) {
            updatedData.heightInCm = heightInCm;
        } else if (!isMetric && heightInFeet && heightInInches) {
            updatedData.heightInFeet = heightInFeet;
            updatedData.heightInInches = heightInInches;
        }

        // Handle weight based on metric preference
        if (isMetric && weightInKg) {
            updatedData.weightInKg = weightInKg;
        } else if (!isMetric && weightInLbs) {
            updatedData.weightInLbs = weightInLbs;
        }

        // Handle target weight (always in kg as per your basicInfo function)
        if (targetWeight) {
            updatedData.targetWeight = targetWeight;
        }

        // Update user with provided data
        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { $set: updatedData },
            { new: true }
        );

        const weight = updatedUser.isMetric
            ? updatedUser.weightInKg
                ? `${updatedUser.weightInKg} kg`
                : null
            : updatedUser.weightInLbs
                ? `${updatedUser.weightInLbs} lbs`
                : null;

        const height = updatedUser.isMetric
            ? updatedUser.heightInCm
                ? `${updatedUser.heightInCm} cm`
                : null
            : updatedUser.heightInFeet && updatedUser.heightInInches
                ? `${updatedUser.heightInFeet} ft ${updatedUser.heightInInches} in`
                : null;

        // Format response data
        const formattedUser = {
            name: updatedUser.name || null,
            email: updatedUser.email || null,
            gender: updatedUser.gender || null,
            mobile: updatedUser.mobile || null,
            age: updatedUser.age ? `${updatedUser.age} years` : null,
            height,
            weight,
            targetWeight: updatedUser.targetWeight ? `${updatedUser.targetWeight} kg` : null,
            goal: updatedUser.goal || null,
            isMetric: updatedUser.isMetric || false
        };

        return res.status(200).json({
            status: true,
            message: 'User details updated successfully',
            data: formattedUser
        });

    } catch (error) {
        console.error('Error in updateBasicInfo:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const profileScreen = async (req, res) => {
    const { userId } = req.body;

    try {
        // Find the user in the database
        const user = await userModel.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User does not exist',
            });
        }

        // Get today's date in the format DD/MM/YYYY
        const today = new Date().toLocaleDateString('en-GB');

        const { 
            name, 
            isMetric, 
            weightInKg, 
            weightInLbs, 
            TDEE, 
            targetWeight, 
            BMI, 
            gender, 
            dailyCalorieGoal,
            dailyConsumptionStats = {} // Provide default empty object
        } = user;

        const weight = isMetric ? weightInKg : weightInLbs;
        
        // Convert dailyConsumptionStats to regular object if it's a Map
        const consumptionStats = dailyConsumptionStats instanceof Map 
            ? Object.fromEntries(dailyConsumptionStats)
            : dailyConsumptionStats;

        const todayConsumption = consumptionStats[today] || 0;
        console.log(user,"////////////////////////");
        
        console.log('Daily Consumption Stats:', consumptionStats);
        console.log('Today\'s Date:', today);
        console.log('Today\'s Consumption:', todayConsumption);

        const userDetails = {
            TDEE,
            weight,
            isMetric,
            targetWeight,
            BMI,
            name,
            profilephoto: null,
            gender,
            dailyCalorieGoal,
            todayConsumption
        };

        return res.status(200).json({
            status: true,
            data: userDetails
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};


const goalGetting = async (req, res) => {
    const { userId } = req.body
    try {
        const user = await userModel.findOne({ _id: userId })
        if (!user) {
            res.status(404).json({
                status: false,
                message: 'User not found'
            })
        }
        const { goal, targetWeight, weightGainRate, activityLevel, mealsPerDay, isMetric, weightInKg, weightInLbs } = user
        const currentWeight = user.isMetric ? weightInKg : weightInLbs

        const result = {
            goal,
            targetWeight,
            weightGainRate,
            activityLevel,
            mealsPerDay,
            isMetric,
            currentWeight
        }
        return res.status(200).json({
            status: true,
            data: result
        })

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        })
    }
}

const updateGoalSetting = async (req, res) => {
    const { userId, targetWeight, weightGainRate, activityLevel, mealsPerDay, goal } = req.body;

    try {
        const user = await userModel.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found',
            });
        }

        let updateDetails = {};

        if (targetWeight) updateDetails.targetWeight = targetWeight;
        if (weightGainRate) updateDetails.weightGainRate = weightGainRate;
        if (activityLevel) updateDetails.activityLevel = activityLevel;
        if (mealsPerDay) updateDetails.mealsPerDay = mealsPerDay;
        if (goal) updateDetails.goal = goal

        await userModel.findByIdAndUpdate(
            userId,
            { $set: updateDetails },
            { new: true } 
        );

        const response = {
            userId,
            targetWeight: updateDetails.targetWeight || user.targetWeight,
            weightGainRate: updateDetails.weightGainRate || user.weightGainRate,
            activityLevel: updateDetails.activityLevel || user.activityLevel,
            mealsPerDay: updateDetails.mealsPerDay || user.mealsPerDay,
            goal: updateDetails.goal || user.goal
        };

        // Send a success response
        return res.status(200).json({
            status: true,
            message: 'Goal settings updated successfully',
            data: response,
        });

    } catch (error) {
        // Handle any errors
        console.error('Error updating goal settings:', error);
        return res.status(500).json({
            status: false,
            message: 'An error occurred while updating goal settings',
        });
    }
};

const deleteUser = async (req, res) => {
    const { userId } = req.body; // Assuming userId is sent in the request body

    try {
        // Validate userId
        if (!userId) {
            return res.status(400).json({
                status: false,
                message: 'User ID is required',
            });
        }

        // Check if the user exists
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found',
            });
        }

        // Create a record in the 'deleted_users' collection
        const deletedUser = new deletedUserModel({
            userId: user._id,
            mobile: user.mobile,
            email: user.email,
            password: user.password,
            otp: user.otp,
            isVerified: user.isVerified,
            name: user.name,
            gender: user.gender,
            heightInFeet: user.heightInFeet,
            heightInInches: user.heightInInches,
            heightInCm: user.heightInCm,
            isMetric: user.isMetric,
            weightInKg: user.weightInKg,
            weightInLbs: user.weightInLbs,
            googleId: user.googleId,
            mealsPerDay: user.mealsPerDay,
            goal: user.goal,
            targetWeight: user.targetWeight,
            weightGainRate: user.weightGainRate,
            activityLevel: user.activityLevel,
            age: user.age,
            BMI: user.BMI,
            BMR: user.BMR,
            TDEE: user.TDEE,
            dailyCalorieGoal: user.dailyCalorieGoal,
            caloriesToReachGoal: user.caloriesToReachGoal,
            daysToReachGoal: user.daysToReachGoal,
            profilePhoto: user.profilePhoto,
        });

        await deletedUser.save(); // Save to deleted_users collection

        // Delete the user from the 'users' collection
        await userModel.findByIdAndDelete(userId);

        // Send success response
        return res.status(200).json({
            status: true,
            message: 'User account deleted and stored in deleted_users collection',
        });
    } catch (error) {
        // Handle any errors
        console.error('Error deleting user:', error.message);
        return res.status(500).json({
            status: false,
            message: 'An error occurred while deleting the user account',
        });
    }
};



module.exports = { profileScreen, basicInfo, updateBasicInfo, goalGetting, updateGoalSetting, deleteUser }