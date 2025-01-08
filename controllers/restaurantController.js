const userModel = require('../models/userModel')
const mongoose = require('mongoose');
const profileModel = require('../models/profileModel')
const mealModel = require('../models/mealModel')
const { getDBInstance } = require('../config/db');

const { MongoClient } = require("mongodb");
const { ObjectId } = require('mongodb');
const client = new MongoClient(process.env.DB_URI);

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
                message: 'missing essential user details'
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
        const grocery = client.db("hungerX").collection("grocerys");

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

    const searchTerm = name.trim().toLowerCase();

    try {
        const products = mongoose.connection.db.collection("products");
        const searchWords = searchTerm.split(/\s+/);

        // Adjust fuzzy search patterns based on word length
        const fuzzySearchPatterns = searchWords.map(word => {
            const variations = [];
            
            // Basic patterns for all lengths
            variations.push(
                new RegExp(`^${word}`, 'i'),     // starts with
                new RegExp(`${word}$`, 'i'),     // ends with
                new RegExp(`${word}`, 'i')       // contains
            );

            // Additional patterns for longer words
            if (word.length > 3) {
                variations.push(
                    new RegExp(word.replace(/s$/, ''), 'i'),    // remove trailing 's'
                    new RegExp(word.replace(/ed$/, ''), 'i'),   // remove 'ed'
                    new RegExp(word.split('').join('.*'), 'i')  // characters in sequence
                );
            }

            return variations;
        }).flat();

        const pipeline = [
            // Stage 1: Initial match using index
            {
                $match: {
                    $or: [
                        { name: { $regex: new RegExp(searchTerm, 'i') } },
                        { brandName: { $regex: new RegExp(searchTerm, 'i') } }
                    ]
                }
            },
            // Stage 2: Add combined text field
            {
                $addFields: {
                    combinedText: {
                        $concat: [
                            { $ifNull: ["$brandName", ""] },
                            " ",
                            { $ifNull: ["$name", ""] }
                        ]
                    }
                }
            },
            // Stage 3: Calculate relevance scores
            {
                $addFields: {
                    exactMatch: {
                        $cond: [
                            { $regexMatch: { input: "$name", regex: new RegExp(`^${searchTerm}$`, 'i') } },
                            10,
                            {
                                $cond: [
                                    { $regexMatch: { input: "$brandName", regex: new RegExp(`^${searchTerm}$`, 'i') } },
                                    8,
                                    0
                                ]
                            }
                        ]
                    },
                    startsWithMatch: {
                        $cond: [
                            { $regexMatch: { input: "$name", regex: new RegExp(`^${searchTerm}`, 'i') } },
                            5,
                            {
                                $cond: [
                                    { $regexMatch: { input: "$brandName", regex: new RegExp(`^${searchTerm}`, 'i') } },
                                    4,
                                    0
                                ]
                            }
                        ]
                    },
                    containsMatch: {
                        $cond: [
                            { $regexMatch: { input: "$combinedText", regex: new RegExp(searchTerm, 'i') } },
                            2,
                            0
                        ]
                    }
                }
            },
            // Stage 4: Calculate final score
            {
                $addFields: {
                    relevanceScore: {
                        $add: ["$exactMatch", "$startsWithMatch", "$containsMatch"]
                    }
                }
            },
            // Stage 5: Filter out low relevance results
            {
                $match: {
                    relevanceScore: { $gt: 0 }
                }
            },
            // Stage 6: Sort by relevance
            {
                $sort: {
                    relevanceScore: -1,
                    name: 1
                }
            },
            { $limit: 15 }
        ];

        const results = await products.aggregate(pipeline, {
            allowDiskUse: true
        }).toArray();

        if (!results || results.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'No matching products found'
            });
        }

        const transformedResults = results.map(item => ({
            _id: item._id,
            brandId: item.brandId,
            productId: item.productId,
            name: item.name,
            brandName: item.brandName || 'Unknown Brand',
            image: item.image,
            nutritionFacts: item.nutritionFacts,
            servingInfo: item.servingInfo,
            relevanceScore: item.relevanceScore
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
const calculateDayTotalCalories = (consumedFoodForDay) => {
    let totalCalories = 0;
    if (!consumedFoodForDay) return totalCalories;

    ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
        if (consumedFoodForDay[mealType]?.foods) {
            totalCalories += consumedFoodForDay[mealType].foods.reduce(
                (sum, food) => sum + (food.totalCalories || 0),
                0
            );
        }
    });

    return totalCalories;
};

const addConsumedFood = async (req, res) => {
    try {
        const db = getDBInstance();
        const users = db.collection("users");
        const groceries = db.collection("grocerys");

        const {
            userId,
            mealType,
            servingSize,
            selectedMeal,
            dishId,
            totalCalories
        } = req.body;

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
        const statsDateKey = `dailyConsumptionStats.${date}`;
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

        const currentDayData = currentUser.consumedFood?.dates?.[date];
        if (!currentDayData?.[mealType.toLowerCase()]) {
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

        const currentCalories = currentUser.dailyConsumptionStats?.[date] || 0;
        const newTotalCalories = currentCalories + Number(totalCalories);

        const dailyCalorieGoal = currentUser.dailyCalorieGoal || 0;
        const newCaloriesToReachGoal = dailyCalorieGoal - newTotalCalories;

        const result = await users.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $push: {
                    [`${dateKey}.${mealType.toLowerCase()}.foods`]: foodEntry
                },
                $set: {
                    [statsDateKey]: newTotalCalories,
                    caloriesToReachGoal: newCaloriesToReachGoal
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        const updatedMeal = updatedUser.consumedFood.dates[date][mealType.toLowerCase()];
        const dailyCalories = updatedUser.dailyConsumptionStats[date];

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
            dailyCalories: dailyCalories,
            updatedCalories: {
                remaining: dailyCalorieGoal - dailyCalories,
                consumed: dailyCalories,
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
        const statsDateKey = `dailyConsumptionStats.${date}`;
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
        const currentDayData = currentUser.consumedFood?.dates?.[date];
        if (!currentDayData?.[mealTypeName]) {
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
        const currentCalories = currentUser.dailyConsumptionStats?.[date] || 0;
        const newTotalCalories = currentCalories + Number(calories);
        const dailyCalorieGoal = currentUser.dailyCalorieGoal || 0;
        const newCaloriesToReachGoal = dailyCalorieGoal - newTotalCalories;
        await users.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $push: {
                    [`${dateKey}.${mealTypeName}.foods`]: foodEntry
                },
                $set: {
                    [statsDateKey]: newTotalCalories,
                    caloriesToReachGoal: newCaloriesToReachGoal
                }
            }
        );
        const updatedUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        const updatedMeal = updatedUser.consumedFood.dates[date][mealTypeName];
        const dailyCalories = updatedUser.dailyConsumptionStats[date];
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
            dailyCalories: dailyCalories,
            updatedCalories: {
                remaining: dailyCalorieGoal - dailyCalories,
                consumed: dailyCalories,
                caloriesToReachGoal: newCaloriesToReachGoal
            }
        });
    } catch (error) {
        console.error('Error adding unknown food:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        const grocery = mongoose.connection.db.collection("grocerys");
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
        const result = await users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $push: {
                    foodHistory: {
                        $each: [historyEntry],
                        $slice: -15
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
                consumedFood: {},
                dailySummary: {
                    totalCalories: 0,
                    dailyGoal: user.dailyCalorieGoal,
                    remaining: parseFloat(user.dailyCalorieGoal)
                }
            });
        }
        let totalDayCalories = 0;
        Object.values(consumedFoodForDate).forEach(meal => {
            if (meal.foods && Array.isArray(meal.foods)) {
                meal.foods.forEach(food => {
                    totalDayCalories += Number(food.totalCalories) || 0;
                });
            }
        });
        const formattedTotalCalories = Number(totalDayCalories.toFixed(2));
        const dailyGoal = parseFloat(user.dailyCalorieGoal);
        const remaining = Number((dailyGoal - formattedTotalCalories).toFixed(2));
        return res.status(200).json({
            success: true,
            message: 'Food entries found',
            date: date,
            consumedFood: consumedFoodForDate,
            dailySummary: {
                totalCalories: formattedTotalCalories,
                dailyGoal: user.dailyCalorieGoal,
                remaining: remaining
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

const deleteDishFromMeal = async (req, res) => {
    try {
        const db = getDBInstance();
        const users = db.collection("users");
        const {
            userId,
            date,
            mealId,
            dishId
        } = req.body;
        if (!userId || !date || !mealId || !dishId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const mealTypeMapping = {
            '6746a024a45e4d9e5d58ea12': 'breakfast',
            '6746a024a45e4d9e5d58ea13': 'lunch',
            '6746a024a45e4d9e5d58ea14': 'dinner',
            '6746a024a45e4d9e5d58ea15': 'snacks'
        };
        const mealType = mealTypeMapping[mealId];
        if (!mealType) {
            return res.status(400).json({ error: 'Invalid meal ID' });
        }
        const user = await users.findOne({
            _id: new mongoose.Types.ObjectId(userId)
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const dateKey = `consumedFood.dates.${date}`;
        const mealKey = `${dateKey}.${mealType}`;
        const currentMeal = user.consumedFood?.dates?.[date]?.[mealType];
        if (!currentMeal || !currentMeal.foods) {
            return res.status(404).json({ error: 'Meal not found for the specified date' });
        }
        const foodToDelete = currentMeal.foods.find(
            food => food.dishId.toString() === dishId || food.foodId.toString() === dishId
        );
        if (!foodToDelete) {
            return res.status(404).json({ error: 'Dish not found in the meal' });
        }
        const caloriesToAddBack = Number(foodToDelete.totalCalories) || 0;
        const currentCaloriesToReachGoal = parseInt(user.caloriesToReachGoal) || 0;
        const newCaloriesToReachGoal = currentCaloriesToReachGoal + caloriesToAddBack;
        const updateOperations = {
            $pull: {
                [`${mealKey}.foods`]: {
                    $or: [
                        { dishId: new mongoose.Types.ObjectId(dishId) },
                        { foodId: new mongoose.Types.ObjectId(dishId) }
                    ]
                }
            },
            $set: {
                caloriesToReachGoal: newCaloriesToReachGoal
            }
        };
        const result = await users.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            updateOperations
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const updatedUser = await users.findOne({
            _id: new mongoose.Types.ObjectId(userId)
        });
        const updatedMeal = updatedUser.consumedFood?.dates?.[date]?.[mealType];
        let totalDayCalories = 0;
        Object.values(updatedUser.consumedFood?.dates?.[date] || {}).forEach(meal => {
            if (meal.foods && Array.isArray(meal.foods)) {
                meal.foods.forEach(food => {
                    totalDayCalories += Number(food.totalCalories) || 0;
                });
            }
        });
        res.status(200).json({
            success: true,
            message: 'Dish deleted successfully',
            date: date,
            mealId: mealId,
            mealType: mealType,
            updatedMeal: updatedMeal,
            dailySummary: {
                totalCalories: totalDayCalories,
                dailyGoal: updatedUser.dailyCalorieGoal,
                remaining: parseFloat(updatedUser.dailyCalorieGoal) - totalDayCalories
            },
            updatedCalories: {
                caloriesToReachGoal: newCaloriesToReachGoal,
                deletedCalories: caloriesToAddBack
            }
        });
    } catch (error) {
        console.error('Error deleting dish:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const searchRestaurant = async (req, res) => {
    const { name } = req.body;
    try {
        const searchTerm = name.trim().toLowerCase();
        const restaurant = mongoose.connection.db.collection("restaurants");
        const restaurantName = await restaurant.findOne({ name: { $regex: searchTerm, $options: 'i' } });
        if (!restaurantName) {
            return res.status(404).json({
                status: false,
                message: 'Restaurant not found'
            });
        }
        return res.status(200).json({
            status: true,
            message: 'Restaurant found',
            data: {
                id: restaurantName._id,
                name: restaurantName.name,
                logo: restaurantName.logo,
            }
        });
    } catch (error) {
        console.error('Search restaurant error:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
};


const suggestions = async (req, res) => {
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const Restaurant = db.collection("restaurants");
        const restaurants = await Restaurant.find({}).project({
            restaurantName: 1,
            address: 1,
            coordinates: 1,
            distance: 1,
            _id: 1,
            logo:1
        }).toArray();
        const formattedRestaurants = restaurants.map(restaurant => ({
            name: restaurant.restaurantName || null,
            address: restaurant.address || null,
            coordinates: restaurant.coordinates || null,
            distance: restaurant.distance || null,
            _id: restaurant._id || null,
            logo:restaurant.logo || null
        }));
        return res.status(200).json({
            status: true,
            restaurants: formattedRestaurants
        });
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
};



module.exports = { getEatPage, eatScreenSearchName, getMeal, searchGroceries, addToHistory, getUserHistory, addConsumedFood, addUnknownFood, getConsumedFoodByDate, deleteDishFromMeal, searchRestaurant, suggestions,  }