const userModel = require('../models/userModel')
const mongoose = require('mongoose')
const { getDBInstance } = require('../config/db');


const { MongoClient } = require("mongodb");
const { ObjectId } = require('mongodb');
const client = new MongoClient("mongodb+srv://hungrx001:b19cQlcRApahiWUD@cluster0.ynchc4e.mongodb.net/hungerX");

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

        // Format both metric and imperial weights
        const weightInKg = user.weightInKg ? `${user.weightInKg}` : null;
        const weightInLbs = user.weightInLbs ? `${user.weightInLbs}` : null;

        // Format both metric and imperial heights
        const heightInCm = user.heightInCm ? `${user.heightInCm}` : null;
        const heightInFeet= user.heightInFeet 
            ? `${user.heightInFeet}` 
            : null;
         const heightInInches = user.heightInInches 
         ? `${user.heightInInches}` 
            : null;
        // Create response object with formatted values and units
        const userProfile = {
            name: user.name || null,
            email: user.email || null,
            gender: user.gender || null,
            phone: user.mobile || null,
            age: user.age ? `${user.age}` : null,
            heightInCm,    // Always show metric height
            heightInFeet,  // Always show imperial height
            heightInInches,
            weightInKg,    // Always show metric weight
            weightInLbs,  // Always show imperial weight
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
        // Find user first
        const user = await userModel.findOne({ _id: userId });
        
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User does not exist'
            });
        }

        // Validate email format if provided
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

        // Format the response similar to basicInfo
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
            phone: updatedUser.mobile || null,
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
    const { userId } = req.body; // Only pass userId from the request body



    try {
        // Find the user in the database
        const user = await userModel.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User does not exist',
            });
        }

        // Extract isMetric and determine the weight
        const { name , isMetric, weightInKg, weightInLbs, TDEE, targetWeight, BMI } = user;
        const weight = isMetric ? weightInKg : weightInLbs;

        // Prepare user details
        const userDetails = {
            TDEE,
            Weight: weight,
            isMetric,
            targetWeight,
            BMI,
            name,
            profilephoto : null
        };

        // Send response
        return res.status(200).json({
            status: true,
            data: userDetails,
           
        });
    } catch (error) {
        // Handle any server error
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};


module.exports = { profileScreen, basicInfo ,updateBasicInfo}