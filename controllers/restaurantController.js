const userModel = require('../models/userModel')
const mongoose = require('mongoose');
const profileModel = require('../models/profileModel')
const mealModel = require('../models/mealModel')
const { getDBInstance } = require('../config/db');

const { MongoClient } = require("mongodb");
const { ObjectId } = require('mongodb');
const client = new MongoClient("mongodb+srv://hungrx001:b19cQlcRApahiWUD@cluster0.ynchc4e.mongodb.net/hungerX");

const getEatPage = async (req, res) => {
    const { userId } = req.body
    try {
        const user = await userModel.findOne({ _id: userId })

        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'user is not exist'
            })
        }
        let profilePhoto

        try {
            const profile = await profileModel.findOne({})
            profilePhoto = user.gender == 'female' ? profile.female : profile.male
        } catch (error) {
            console.log('Error fetching profile photo:', error);

        }

        const { name, dailyCalorieGoal } = user
        if (!name || !dailyCalorieGoal) {
            return res.status(404).json({
                status: false,
                message: 'missing essantial user details'
            })
        }
        return res.status(200).json({
            status: true,
            data: {
                name,
                dailyCalorieGoal,
                profilePhoto
            }
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: false,
            message: error
        })
    }
}


const eatScreenSearchName = async (req, res) => {
    const { name } = req.body;

    try {
        await client.connect();
        const grocery = client.db("hungerX").collection("grocery");

        const results = await grocery.aggregate([
            {
                $match: {
                    name: { $regex: name, $options: 'i' } 
                }
            },
            {
                $unionWith: {
                    coll: "restaurants",
                    pipeline: [
                        {
                            $match: {
                                name: { $regex: name, $options: 'i' }
                            }
                        }
                    ]
                }
            },
            {
                $limit: 15 
            }
        ]).toArray();

        if (!results || results.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'No matching items found'
            });
        }

        
        const transformedResults = results.map(item => {
            const type = item.menus ? 'restaurant' : 'grocery';
            const isRestaurant = type === 'restaurant';

            if (isRestaurant) {
                return {
                    type,
                    isRestaurant,
                    _id: item._id,
                    id: item.id,
                    name: item.name,
                    logo: item.logo,
                    menus: item.menus,
                    source: item.source,
                    updatedAt: item.updatedAt
                };
            } else {
                return {
                    type,
                    isRestaurant,
                    _id: item._id,
                    id: item.id,
                    name: item.name,
                    calorieBurnNote: item.calorieBurnNote,
                    category: item.category,
                    image: item.image,
                    nutritionFacts: item.nutritionFacts,
                    servingInfo: item.servingInfo,
                    source: item.source,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt
                };
            }
        });

        return res.status(200).json({
            status: true,
            count: results.length,
            data: transformedResults
        });

    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    } finally {
        await client.close();
    }
};

const getMeal = async (req, res) => {
    try {

        const meals = await mealModel.find({})
        console.log(meals);

        res.status(200).json({
            status: true,
            message: 'Meals fetched successfully',
            data: meals
        })
    } catch (error) {
        console.log(error);

        res.status(500).json({
            status: false,
            message: 'Failed to fetch meals. Please try again later.'
        })
    }
}

const searchGroceries = async (req, res) => {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
        return res.status(400).json({
            status: false,
            message: 'Search term is required'
        });
    }

    try {
        const grocery = mongoose.connection.db.collection("grocery");

        const searchTerm = name.trim().toLowerCase();
        const flexiblePattern = searchTerm
            .split('')
            .map(char => `${char}+`)
            .join('.*?');

        const results = await grocery.aggregate([
            {
                $match: {
                    $or: [
                        { name: new RegExp(`\\b${searchTerm}\\b`, 'i') },
                        { name: new RegExp(`\\b${flexiblePattern}\\b`, 'i') },
                        { name: new RegExp(searchTerm, 'i') }
                    ]
                }
            },
            {
                $addFields: {
                    score: {
                        $add: [
                            {
                                $cond: [
                                    { $regexMatch: { input: "$name", regex: new RegExp(`\\b${searchTerm}\\b`, 'i') } },
                                    1000,
                                    0
                                ]
                            },
                            {
                                $multiply: [
                                    { $subtract: [50, { $strLenCP: "$name" }] },
                                    2
                                ]
                            },
                            {
                                $cond: [
                                    { $regexMatch: { input: "$name", regex: new RegExp(`\\b${flexiblePattern}\\b`, 'i') } },
                                    500,
                                    0
                                ]
                            },
                            {
                                $cond: [
                                    { $regexMatch: { input: "$name", regex: new RegExp(searchTerm, 'i') } },
                                    100,
                                    0
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: "$name",
                    item: { $first: "$$ROOT" }
                }
            },
            {
                $replaceRoot: { newRoot: "$item" }
            },
            {
                $sort: {
                    score: -1,
                    name: 1
                }
            },
            { $limit: 15 }
        ]).toArray();

        if (!results || results.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'No matching grocery items found'
            });
        }

        const transformedResults = results.map(item => ({
            _id: item._id,
            id: item.id,
            name: item.name,
            brandName: item.brandName || 'Unknown Brand',
            calorieBurnNote: item.calorieBurnNote,
            category: item.category,
            image: item.image,
            nutritionFacts: item.nutritionFacts,
            servingInfo: item.servingInfo,
            source: item.source,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            searchScore: item.score
        }));

        return res.status(200).json({
            status: true,
            count: results.length,
            data: transformedResults
        });

    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const addToHistory = async (req, res) => {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
        return res.status(400).json({
            status: false,
            message: 'User ID and Product ID are required'
        });
    }

    try {
        const grocery = mongoose.connection.db.collection("grocery");
        const users = mongoose.connection.db.collection("users");

        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        const foodItem = await grocery.findOne({ _id: new ObjectId(productId) });
        if (!foodItem) {
            return res.status(404).json({
                status: false,
                message: 'Food item not found'
            });
        }

        const now = new Date();
        const searchDate = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
        const searchTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const historyEntry = {
            foodId: new ObjectId(productId),
            name: foodItem.name,
            brandName: foodItem.brandName || 'Unknown Brand',
            image: foodItem.image,
            nutritionFacts: foodItem.nutritionFacts,
            servingInfo: foodItem.servingInfo || foodItem.serving_info,
            viewedAt: now,
            searchDate: searchDate,
            searchTime: searchTime
        };

        // Update user's foodHistory using $push with $slice
        const result = await users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $push: {
                    foodHistory: {
                        $each: [historyEntry],
                        $slice: -15  // Keep only the last 15 items
                    }
                }
            }
        );

        return res.status(200).json({
            status: true,
            message: 'Added to history successfully',
            data: historyEntry
        });

    } catch (error) {
        console.error("Error adding to history:", error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};


const getUserHistory = async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({
            status: false,
            message: 'User ID is required'
        });
    }

    try {
        const users = mongoose.connection.db.collection("users");
        
        const user = await users.findOne(
            { _id: new ObjectId(userId) },
            { projection: { foodHistory: 1 } }
        );

        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        // Sort the foodHistory array by viewedAt in descending order
        const sortedHistory = user.foodHistory ? 
            user.foodHistory.sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt)) 
            : [];

        return res.status(200).json({
            status: true,
            count: sortedHistory.length,
            data: sortedHistory
        });

    } catch (error) {
        console.error("Error fetching history:", error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const addConsumedFood = async (req, res) => {
    try {
        const db = getDBInstance();
        const users = db.collection("users");
        const groceries = db.collection("grocery");

        const {
            userId,
            mealType,
            servingSize,
            selectedMeal,
            dishId,
            totalCalories
        } = req.body;

        // Get food details from groceries collection
        const foodDetails = await groceries.findOne({ _id: new mongoose.Types.ObjectId(dishId) });
        if (!foodDetails) {
            return res.status(404).json({ error: 'Food item not found in grocery database' });
        }

        const today = new Date();
        const date = today.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '/');

        const validMealIds = {
            'breakfast': '6746a024a45e4d9e5d58ea12',
            'lunch': '6746a024a45e4d9e5d58ea13',
            'dinner': '6746a024a45e4d9e5d58ea14',
            'snacks': '6746a024a45e4d9e5d58ea15'
        };

        if (!validMealIds[mealType.toLowerCase()]) {
            return res.status(400).json({ error: 'Invalid meal type' });
        }

        const dateKey = `consumedFood.dates.${date}`;
        const mealKey = `${dateKey}.${mealType.toLowerCase()}`;

        const foodEntry = {
            servingSize: Number(servingSize),
            selectedMeal: new mongoose.Types.ObjectId(selectedMeal),
            dishId: new mongoose.Types.ObjectId(dishId),
            totalCalories: Number(totalCalories),
            timestamp: today,
            name: foodDetails.name,
            brandName: foodDetails.brandName,
            image: foodDetails.image,
            nutritionFacts: foodDetails.nutritionFacts,
            servingInfo: foodDetails.servingInfo,
            foodId: new mongoose.Types.ObjectId()
        };

        const currentUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentCalories = parseInt(currentUser.caloriesToReachGoal) || 0;
        const newCaloriesToReachGoal = currentCalories - Number(totalCalories);

        // Initialize the meal structure if it doesn't exist
        const userMealData = currentUser.consumedFood?.dates?.[date]?.[mealType.toLowerCase()];
        if (!userMealData) {
            await users.updateOne(
                { _id: new mongoose.Types.ObjectId(userId) },
                {
                    $set: {
                        [`${dateKey}.${mealType.toLowerCase()}`]: {
                            mealId: validMealIds[mealType.toLowerCase()],
                            foods: []
                        }
                    }
                }
            );
        }

        // Add only to consumed foods, not to history
        const result = await users.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $push: {
                    [`${dateKey}.${mealType.toLowerCase()}.foods`]: foodEntry
                },
                $set: {
                    caloriesToReachGoal: newCaloriesToReachGoal
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        const updatedMeal = updatedUser.consumedFood.dates[date][mealType.toLowerCase()];
        const remainingCalories = parseInt(updatedUser.dailyCalorieGoal) - Number(totalCalories);

        res.status(200).json({
            success: true,
            message: 'Consumed food added successfully',
            date: date,
            mealId: selectedMeal,
            foodDetails: {
                id: dishId,
                ...foodDetails,
                mealType: mealType.toLowerCase(),
                mealId: validMealIds[mealType.toLowerCase()]
            },
            updatedMeal: updatedMeal,
            updatedCalories: {
                remaining: remainingCalories,
                consumed: Number(totalCalories),
                caloriesToReachGoal: newCaloriesToReachGoal
            }
        });
    } catch (error) {
        console.error('Error adding consumed food:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addUnknownFood = async (req, res) => {
    try {
        const db = getDBInstance();
        const users = db.collection("users");
        const groceries = db.collection("groceries");

        const {
            userId,
            mealType,
            foodName,
            calories
        } = req.body;

        const today = new Date();
        const date = today.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '/');

        const unknownFoodId = new mongoose.Types.ObjectId();

        const mealTypeMapping = {
            '6746a024a45e4d9e5d58ea12': 'breakfast',
            '6746a024a45e4d9e5d58ea13': 'lunch',
            '6746a024a45e4d9e5d58ea14': 'dinner',
            '6746a024a45e4d9e5d58ea15': 'snacks'
        };

        const mealTypeName = mealTypeMapping[mealType];
        if (!mealTypeName) {
            return res.status(400).json({ error: 'Invalid meal type ID' });
        }

        const dateKey = `consumedFood.dates.${date}`;
        const mealKey = `${dateKey}.${mealTypeName}`;

        // Create a new food entry in groceries collection
        const newGroceryItem = {
            _id: unknownFoodId,
            name: foodName,
            brandName: "Custom Food",
            nutritionFacts: {
                calories: Number(calories)
            },
            servingInfo: {
                size: 1,
                unit: "serving"
            },
            isCustomFood: true
        };

        await groceries.insertOne(newGroceryItem);

        const foodEntry = {
            servingSize: 1,
            selectedMeal: new mongoose.Types.ObjectId(mealType),
            dishId: unknownFoodId,
            totalCalories: Number(calories),
            timestamp: today,
            name: foodName,
            brandName: "Custom Food",
            nutritionFacts: {
                calories: Number(calories)
            },
            servingInfo: {
                size: 1,
                unit: "serving"
            },
            isCustomFood: true,
            foodId: new mongoose.Types.ObjectId()
        };

        const currentUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentCalories = parseInt(currentUser.caloriesToReachGoal) || 0;
        const newCaloriesToReachGoal = currentCalories - Number(calories);

        // Initialize the meal structure if it doesn't exist
        const userMealData = currentUser.consumedFood?.dates?.[date]?.[mealTypeName];
        if (!userMealData) {
            await users.updateOne(
                { _id: new mongoose.Types.ObjectId(userId) },
                {
                    $set: {
                        [`${dateKey}.${mealTypeName}`]: {
                            mealId: mealType,
                            foods: []
                        }
                    }
                }
            );
        }

        // Only update consumed food
        const result = await users.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $push: {
                    [`${dateKey}.${mealTypeName}.foods`]: foodEntry
                },
                $set: {
                    caloriesToReachGoal: newCaloriesToReachGoal
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        const updatedMeal = updatedUser.consumedFood.dates[date][mealTypeName];
        const remainingCalories = parseInt(updatedUser.dailyCalorieGoal) - Number(calories);

        res.status(200).json({
            success: true,
            message: 'Unknown food added successfully',
            date: date,
            mealId: mealType,
            foodDetails: {
                id: unknownFoodId,
                ...newGroceryItem,
                mealType: mealTypeName,
                mealId: mealType
            },
            updatedMeal: updatedMeal,
            updatedCalories: {
                remaining: remainingCalories,
                consumed: Number(calories),
                caloriesToReachGoal: newCaloriesToReachGoal
            }
        });

    } catch (error) {
        console.error('Error adding unknown food:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
const getConsumedFoodByDate = async (req, res) => {
    try {
        const db = getDBInstance();
        const users = db.collection("users");
        const { userId, date } = req.body;

        const user = await users.findOne({ 
            _id: new mongoose.Types.ObjectId(userId)
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const consumedFoodForDate = user.consumedFood?.dates?.[date] || {};

        if (Object.keys(consumedFoodForDate).length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No food entries found for this date',
                date: date,
                consumedFood: {}
            });
        }

        // Calculate total calories for the day
        let totalDayCalories = 0;
        Object.values(consumedFoodForDate).forEach(meal => {
            totalDayCalories += meal.totalCalories || 0;
        });

        return res.status(200).json({
            success: true,
            message: 'Food entries found',
            date: date,
            consumedFood: consumedFoodForDate,
            dailySummary: {
                totalCalories: totalDayCalories,
                dailyGoal: user.dailyCalorieGoal,
                remaining: user.dailyCalorieGoal - totalDayCalories
            }
        });

    } catch (error) {
        console.error('Error fetching consumed food:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// const deleteDishFromMeal = async(req,res)=>{
//     try {
        
//     } catch (error) {
        
//     }
// }


module.exports = { getEatPage, eatScreenSearchName, getMeal, searchGroceries, addToHistory, getUserHistory, addConsumedFood ,addUnknownFood , getConsumedFoodByDate}