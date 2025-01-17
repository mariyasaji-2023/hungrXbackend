const { MongoClient } = require("mongodb")
const { ObjectId } = require("mongodb")
const client = new MongoClient(process.env.DB_URI)
const mongoose = require("mongoose")

// const get = async(req, res) => {
//     try {
//         await client.connect();
//         const db = client.db();
//         const commonfood = db.collection("commonfoods");
        
//         const categories = await commonfood.aggregate([
//             { $unwind: "$category.sub" },
//             { 
//                 $group: {
//                     _id: "$category.sub"
//                 }
//             },
//             { $sort: { _id: 1 } },
//             {
//                 $project: {
//                     _id: 0,
//                     name: "$_id"
//                 }
//             }
//         ]).toArray();

//         if (!categories || categories.length === 0) {
//             return res.status(400).json({
//                 status: false,
//                 message: "Categories not found"
//             });
//         }

//         // Extract just the names into an array
//         const subcategoryNames = categories.map(cat => cat.name);

//         return res.status(200).json({
//             status: true,
//             subcategories: subcategoryNames
//         });
//     } catch (error) {
//         return res.status(400).json({
//             status: false,
//             message: 'internal server error',
//             error: error.message
//         });
//     } finally {
//         await client.close();
//     }
// }

const searchCommonfood = async(req, res) => {
    const { name } = req.body;
    try {
        if(!name || name.trim().length === 0) {
            return res.status(400).json({
                status: false,
                message: 'Search term is required'
            });
        }

        const searchTerm = name.trim().toLowerCase();
        const commonfood = mongoose.connection.db.collection('commonfoods');
        
        // Split search term into individual words
        const searchWords = searchTerm.split(/\s+/);
        
        // Create an array of regex patterns for each word
        const wordPatterns = searchWords.map(word => new RegExp(word, "i"));
        
        // Construct a more flexible query that matches individual words
        const query = {
            $or: [
                // Match name containing any of the search words
                { name: { $in: wordPatterns } },
                // Match main category containing any of the search words
                { "category.main": { $in: wordPatterns } },
                // Match sub categories containing any of the search words
                { "category.sub": { $elemMatch: { $in: wordPatterns } } }
            ]
        };

        // Add exact phrase matching as an additional condition
        const exactPhraseQuery = {
            $or: [
                { name: { $regex: new RegExp(searchTerm, "i") } },
                { "category.main": { $regex: new RegExp(searchTerm, "i") } },
                { "category.sub": { $regex: new RegExp(searchTerm, "i") } }
            ]
        };

        // Combine both queries
        const finalQuery = {
            $or: [query, exactPhraseQuery]
        };

        const results = await commonfood.aggregate([
            { $match: finalQuery },
            // Add scoring to prioritize more relevant matches
            {
                $addFields: {
                    score: {
                        $add: [
                            // Exact name match gets highest score
                            { $cond: [{ $regexMatch: { input: "$name", regex: new RegExp(`^${searchTerm}$`, "i") } }, 10, 0] },
                            // Partial name match gets medium score
                            { $cond: [{ $regexMatch: { input: "$name", regex: new RegExp(searchTerm, "i") } }, 5, 0] },
                            // Category matches get lower scores
                            { $cond: [{ $regexMatch: { input: "$category.main", regex: new RegExp(searchTerm, "i") } }, 3, 0] },
                            { $cond: [{ $in: [true, { $map: { input: "$category.sub", as: "sub", in: { $regexMatch: { input: "$$sub", regex: new RegExp(searchTerm, "i") } } } }] }, 2, 0] }
                        ]
                    }
                }
            },
            { $sort: { score: -1 } },
            { $limit: 15 },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    "category.main": 1,
                    "category.sub": 1,
                    servingInfo: 1,
                    nutritionFacts: 1,
                    image: 1,
                    score: 1  // Include score in output for debugging
                }
            }
        ]).toArray();

        if (!results || results.length === 0) {
            return res.status(400).json({
                status: false,
                message: 'No matching results found'
            });
        }

        return res.status(200).json({
            status: true,
            count: results.length,
            data: results
        });
    } catch (error) {
        console.error("Error during search:", error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
            error: error.message
        });
    }
};


const addConsumedCommonFood = async (req, res) => {
    try {
        const db = client.db(process.env.DB_NAME);
        const users = db.collection("users");
        const commonFoods = db.collection("commonfoods");

        const {
            userId,
            mealType,
            servingSize,
            selectedMeal,
            dishId,
            totalCalories
        } = req.body;

        const foodDetails = await commonFoods.findOne({ _id: new mongoose.Types.ObjectId(dishId) });
        if (!foodDetails) {
            return res.status(404).json({ error: 'Food item not found in common foods database' });
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
            image: foodDetails.image,
            nutritionFacts: foodDetails.nutritionFacts,
            servingInfo: foodDetails.servingInfo,
            category: foodDetails.category,
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

        const result = await users.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $push: {
                    [`${dateKey}.${mealType.toLowerCase()}.foods`]: foodEntry
                },
                $set: {
                    [statsDateKey]: newTotalCalories
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        const updatedMeal = updatedUser.consumedFood.dates[date][mealType.toLowerCase()];
        const dailyCalories = updatedUser.dailyConsumptionStats[date];
        const updatedCaloriesToReachGoal = updatedUser.caloriesToReachGoal;

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
                caloriesToReachGoal: updatedCaloriesToReachGoal
            }
        });
    } catch (error) {
        console.error('Error adding consumed food:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addCommonFoodToHistory = async (req, res) => {
    try {
        const db = client.db(process.env.DB_NAME);
        const users = db.collection("users");
        const commonFoods = db.collection("commonfoods");

        const { userId, dishId } = req.body;

        if (!userId || !dishId) {
            return res.status(400).json({
                status: false,
                message: 'User ID and Dish ID are required'
            });
        }

        // Find user
        const user = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        // Find food item in common foods
        const foodItem = await commonFoods.findOne({ _id: new mongoose.Types.ObjectId(dishId) });
        if (!foodItem) {
            return res.status(404).json({
                status: false,
                message: 'Food item not found in common foods database'
            });
        }

        // Create timestamp and formatted date/time
        const now = new Date();
        const searchDate = now.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '-');
        const searchTime = now.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        // Create history entry
        const historyEntry = {
            foodId: new mongoose.Types.ObjectId(dishId),
            name: foodItem.name,
            brandName: 'Common Food',  // Since it's from common foods
            image: foodItem.image,
            nutritionFacts: foodItem.nutritionFacts,
            servingInfo: foodItem.servingInfo,
            category: foodItem.category,
            viewedAt: now,
            searchDate: searchDate,
            searchTime: searchTime
        };

        // Update user's food history
        const result = await users.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $push: {
                    foodHistory: {
                        $each: [historyEntry],
                        $slice: -15  // Keep only the last 15 entries
                    }
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                status: false,
                message: 'Failed to update user history'
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Added to history successfully',
            data: historyEntry
        });

    } catch (error) {
        console.error('Error adding common food to history:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};
module.exports = { searchCommonfood,addConsumedCommonFood,addCommonFoodToHistory }