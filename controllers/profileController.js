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

        // Basic info updates
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

        if (targetWeight) {
            updatedData.targetWeight = targetWeight;
        }

        // Calculate metrics using updated values
        const newIsMetric = typeof isMetric === 'boolean' ? isMetric : user.isMetric;
        
        // Calculate weight in kg for calculations
        const weightForCalc = newIsMetric 
            ? (weightInKg || user.weightInKg)
            : ((weightInLbs || user.weightInLbs) * 0.453592);

        // Calculate height in meters for calculations
        const heightForCalc = newIsMetric
            ? ((heightInCm || user.heightInCm) / 100)
            : (((heightInFeet || user.heightInFeet) * 12 + (heightInInches || user.heightInInches)) * 0.0254);

        // Calculate BMI
        if (weightForCalc && heightForCalc) {
            updatedData.BMI = (weightForCalc / (heightForCalc ** 2)).toFixed(2);
        }

        // Calculate BMR
        if (weightForCalc && heightForCalc && (age || user.age) && (gender || user.gender)) {
            const calcAge = age || user.age;
            const calcGender = gender || user.gender;
            
            updatedData.BMR = calcGender === 'male'
                ? (10 * weightForCalc + 6.25 * (heightForCalc * 100) - 5 * calcAge + 5).toFixed(2)
                : (10 * weightForCalc + 6.25 * (heightForCalc * 100) - 5 * calcAge - 161).toFixed(2);

            // Calculate TDEE
            const activityMultiplier = {
                'sedentary': 1.2,
                'lightly active': 1.375,
                'moderately active': 1.55,
                'very active': 1.725,
                'extra active': 1.9,
            };
            
            updatedData.TDEE = (updatedData.BMR * (activityMultiplier[user.activityLevel] || 1.2)).toFixed(2);

            // Calculate daily water intake
            let baseWaterIntake = weightForCalc * 30;
            const activityWaterMultiplier = {
                'sedentary': 1.0,
                'lightly active': 1.1,
                'moderately active': 1.2,
                'very active': 1.3,
                'extra active': 1.4,
            };
            baseWaterIntake *= activityWaterMultiplier[user.activityLevel] || 1.0;
            if (calcAge > 55) {
                baseWaterIntake *= 1.1;
            }
            updatedData.dailyWaterIntake = (baseWaterIntake / 1000).toFixed(2);

            // Calculate weight-related goals
            const newTargetWeight = targetWeight || user.targetWeight;
            if (newTargetWeight) {
                const weightChange = (Number(newTargetWeight) * (newIsMetric ? 1 : 0.453592) - weightForCalc);
                const weeklyRate = user.weightGainRate || 0.25;
                
                updatedData.caloriesToReachGoal = Math.abs(weightChange * 7700).toFixed(2);
                
                // Calculate daily calorie goal
                let dailyCalorieGoal = Number(updatedData.TDEE);
                const dailyCalorieAdjustment = (weeklyRate * 7700) / 7;

                if (user.goal === 'gain weight') {
                    dailyCalorieGoal += dailyCalorieAdjustment;
                } else if (user.goal === 'lose weight') {
                    dailyCalorieGoal -= dailyCalorieAdjustment;
                }

                // Ensure minimum calories
                const minCalories = (gender || user.gender) === 'male' ? 1500 : 1200;
                dailyCalorieGoal = Math.max(dailyCalorieGoal, minCalories);
                
                updatedData.dailyCalorieGoal = dailyCalorieGoal.toFixed(2);
                
                // Calculate days to reach goal
                if (weightChange !== 0 && weeklyRate !== 0) {
                    updatedData.daysToReachGoal = Math.ceil((updatedData.caloriesToReachGoal / (weeklyRate * 7700)) * 7);
                }
            }
        }

        // Update user with provided data and calculations
        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { $set: updatedData },
            { new: true }
        );

        // Format response
        const weight = updatedUser.isMetric
            ? updatedUser.weightInKg ? `${updatedUser.weightInKg} kg` : null
            : updatedUser.weightInLbs ? `${updatedUser.weightInLbs} lbs` : null;

        const height = updatedUser.isMetric
            ? updatedUser.heightInCm ? `${updatedUser.heightInCm} cm` : null
            : updatedUser.heightInFeet && updatedUser.heightInInches
                ? `${updatedUser.heightInFeet} ft ${updatedUser.heightInInches} in`
                : null;

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
            isMetric: updatedUser.isMetric || false,
            // Add calculated metrics to response
            BMI: updatedUser.BMI || null,
            BMR: updatedUser.BMR || null,
            TDEE: updatedUser.TDEE || null,
            dailyCalorieGoal: updatedUser.dailyCalorieGoal || null,
            caloriesToReachGoal: updatedUser.caloriesToReachGoal || null,
            daysToReachGoal: updatedUser.daysToReachGoal || null,
            dailyWaterIntake: updatedUser.dailyWaterIntake || null
        };

        return res.status(200).json({
            status: true,
            message: 'User details and calculations updated successfully',
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
        if (goal) updateDetails.goal = goal;

        // Get all necessary user data for calculations
        const weight = user.isMetric ? user.weightInKg : user.weightInLbs * 0.453592;
        const height = user.isMetric
            ? user.heightInCm / 100
            : ((user.heightInFeet * 12) + user.heightInInches) * 0.0254;

        // Calculate BMR
        const BMR = user.gender === 'male'
            ? 10 * weight + 6.25 * (height * 100) - 5 * user.age + 5
            : 10 * weight + 6.25 * (height * 100) - 5 * user.age - 161;

        // Calculate TDEE
        const activityMultiplier = {
            'sedentary': 1.2,
            'lightly active': 1.375,
            'moderately active': 1.55,
            'very active': 1.725,
            'extra active': 1.9,
        };
        const newActivityLevel = updateDetails.activityLevel || user.activityLevel;
        const TDEE = BMR * (activityMultiplier[newActivityLevel] || 1.2);

        // Calculate water intake
        const calculateWaterIntake = () => {
            let baseWaterIntake = weight * 30;
            const activityWaterMultiplier = {
                'sedentary': 1.0,
                'lightly active': 1.1,
                'moderately active': 1.2,
                'very active': 1.3,
                'extra active': 1.4,
            };
            baseWaterIntake *= activityWaterMultiplier[newActivityLevel] || 1.0;
            if (user.age > 55) {
                baseWaterIntake *= 1.1;
            }
            return (baseWaterIntake / 1000).toFixed(2);
        };

        // Calculate BMI
        const BMI = (weight / (height ** 2)).toFixed(2);

        // Calculate weight change with direction
        const newTargetWeight = updateDetails.targetWeight || user.targetWeight;
        const weightChange = newTargetWeight 
            ? (Number(newTargetWeight) * (user.isMetric ? 1 : 0.453592) - weight) 
            : 0;

        // Calculate daily calories and adjustments
        const minCalories = user.gender === 'male' ? 1500 : 1200;
        const newGoal = updateDetails.goal || user.goal;
        const newWeightGainRate = updateDetails.weightGainRate || user.weightGainRate || 0.25;

        // Set weekly rate based on goal
        let weeklyRate = 0;
        if (newGoal === 'gain weight' || newGoal === 'lose weight') {
            weeklyRate = newWeightGainRate;
        }

        const dailyCalorieAdjustment = (weeklyRate * 7700) / 7;

        // Set daily calorie goal based on goal direction
        let dailyCalorieGoal = TDEE;
        if (newGoal === 'gain weight') {
            dailyCalorieGoal += dailyCalorieAdjustment;
        } else if (newGoal === 'lose weight') {
            dailyCalorieGoal -= dailyCalorieAdjustment;
        }

        // Ensure minimum calories
        dailyCalorieGoal = Math.max(dailyCalorieGoal, minCalories);

        // Calculate goal-related metrics
        const caloriesToReachGoal = Math.abs(weightChange * 7700);
        const weeklyCaloricChange = weeklyRate * 7700;
        const daysToReachGoal = weightChange !== 0 && weeklyRate !== 0
            ? Math.ceil((caloriesToReachGoal / weeklyCaloricChange) * 7)
            : 0;

        // Add calculated metrics to update details
        updateDetails.BMI = BMI;
        updateDetails.BMR = BMR.toFixed(2);
        updateDetails.TDEE = TDEE.toFixed(2);
        updateDetails.dailyCalorieGoal = dailyCalorieGoal.toFixed(2);
        updateDetails.caloriesToReachGoal = caloriesToReachGoal.toFixed(2);
        updateDetails.daysToReachGoal = daysToReachGoal;
        updateDetails.dailyWaterIntake = calculateWaterIntake();

        // Update user with new values and calculations
        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { $set: updateDetails },
            { new: true }
        );

        return res.status(200).json({
            status: true,
            message: 'Goal settings and calculations updated successfully',
            data: {
                targetWeight: updatedUser.targetWeight,
                weightGainRate: updatedUser.weightGainRate,
                activityLevel: updatedUser.activityLevel,
                mealsPerDay: updatedUser.mealsPerDay,
                goal: updatedUser.goal,
                BMI: updatedUser.BMI,
                BMR: updatedUser.BMR,
                TDEE: updatedUser.TDEE,
                dailyCalorieGoal: updatedUser.dailyCalorieGoal,
                caloriesToReachGoal: updatedUser.caloriesToReachGoal,
                daysToReachGoal: updatedUser.daysToReachGoal,
                dailyWaterIntake: updatedUser.dailyWaterIntake
            }
        });

    } catch (error) {
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