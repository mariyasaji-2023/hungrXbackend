const userModel = require('../models/userModel')
const mongoose = require('mongoose');
const profileModel = require('../models/profileModel')
const mealModel = require('../models/mealModel')

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
                    name: { $regex: name, $options: 'i' } // Case insensitive search
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
                $limit: 15 // Limit results to 15 documents
            }
        ]).toArray();

        if (!results || results.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'No matching items found'
            });
        }

        // Transform the results to include type and isRestaurant information
        const transformedResults = results.map(item => {
            // Check if it's a restaurant (has menus array) or grocery item
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
            brandName: item.brandName || 'Unknown Brand', // Added brandName with fallback
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
        const history = mongoose.connection.db.collection("history");
        const users = mongoose.connection.db.collection("users");

        // Validate user exists
        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        // Find the food item in grocery collection
        const foodItem = await grocery.findOne({ _id: new ObjectId(productId) });
        if (!foodItem) {
            return res.status(404).json({
                status: false,
                message: 'Food item not found'
            });
        }

        // Get current date and time
        const now = new Date();
        const searchDate = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
        const searchTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        // Create history entry
        const historyEntry = {
            userId: new ObjectId(userId),
            productId: new ObjectId(productId),
            foodItem: {
                id: foodItem.id || foodItem._id,
                name: foodItem.name,
                brandName: foodItem.brandName || 'Unknown Brand',
                image: foodItem.image,
                nutritionFacts: foodItem.nutritionFacts,
                servingInfo: foodItem.servingInfo || foodItem.serving_info // handle both formats
            },
            searchInfo: {
                date: searchDate,
                time: searchTime,
                timestamp: now
            },
            viewedAt: now
        };

        // Save to history collection
        const result = await history.insertOne(historyEntry);

        // Update user's food history array if it exists
        await users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $push: {
                    foodHistory: {
                        foodId: new ObjectId(productId),
                        viewedAt: now,
                        searchDate: searchDate,
                        searchTime: searchTime
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

// Get user's food history
const getUserHistory = async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({
            status: false,
            message: 'User ID is required'
        });
    }

    try {
        const history = mongoose.connection.db.collection("history");

        // Get user's history with most recent items first
        const userHistory = await history
            .find({ userId: new ObjectId(userId) })
            .sort({ viewedAt: -1 })
            .toArray();

        return res.status(200).json({
            status: true,
            count: userHistory.length,
            data: userHistory
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
        await client.connect();
        const db = client.db("hungerX");
        const users = db.collection("users");

        const {
            userId,
            mealType,
            servingSize,
            selectedMeal,
            dishId,
            totalCalories
        } = req.body;

        // Get current date in DD/MM/YYYY format
        const today = new Date();
        const date = today.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '/');

        // Validate meal type
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
            selectedMeal: new ObjectId(selectedMeal),
            dishId: new ObjectId(dishId),
            totalCalories: Number(totalCalories),
            timestamp: today
        };

        // Update user's consumed food and adjust caloriesToReachGoal
        const result = await users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    [mealKey]: foodEntry
                },
                $inc: {
                    caloriesToReachGoal: -Number(totalCalories)
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Fetch updated user data
        const updatedUser = await users.findOne({ _id: new ObjectId(userId) });
        const remainingCalories = updatedUser.dailyCalorieGoal - Number(totalCalories);

        res.status(200).json({
            success: true,
            message: 'Consumed food added successfully',
            date: date,
            updatedCalories: {
                remaining: remainingCalories,
                consumed: Number(totalCalories),
                caloriesToReachGoal: updatedUser.caloriesToReachGoal
            }
        });
    } catch (error) {
        console.error('Error adding consumed food:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        await client.close();
    }
};
module.exports = { getEatPage, eatScreenSearchName, getMeal, searchGroceries, addToHistory, getUserHistory, addConsumedFood }