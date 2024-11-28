const userModel = require('../models/userModel')
const profileModel = require('../models/profileModel')
const mealModel = require('../models/mealModel')

const { MongoClient } = require("mongodb");
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
        await client.connect();
        const grocery = client.db("hungerX").collection("grocery");

        // Clean and prepare search term
        const searchTerm = name.trim().toLowerCase();
        
        // Create patterns for matching
        const flexiblePattern = searchTerm
            .split('')
            .map(char => `${char}+`)
            .join('.*?');

        const results = await grocery.aggregate([
            {
                $match: {
                    $or: [
                        // Simple word matches first
                        { name: new RegExp(`\\b${searchTerm}\\b`, 'i') },  // Exact word match
                        { name: new RegExp(`\\b${flexiblePattern}\\b`, 'i') },  // Flexible word match
                        { name: new RegExp(searchTerm, 'i') }  // Contains the term anywhere
                    ]
                }
            },
            { 
                $addFields: {
                    score: {
                        $add: [
                            // Exact single word match gets highest score
                            { 
                                $cond: [
                                    { $regexMatch: { input: "$name", regex: new RegExp(`\\b${searchTerm}\\b`, 'i') } },
                                    1000,
                                    0
                                ]
                            },
                            // Bonus points for shorter names (prioritizes "egg" over "egg and cheese...")
                            {
                                $multiply: [
                                    { $subtract: [50, { $strLenCP: "$name" }] },
                                    2
                                ]
                            },
                            // Flexible word match
                            {
                                $cond: [
                                    { $regexMatch: { input: "$name", regex: new RegExp(`\\b${flexiblePattern}\\b`, 'i') } },
                                    500,
                                    0
                                ]
                            },
                            // Contains the term
                            {
                                $cond: [
                                    { $regexMatch: { input: "$name", regex: new RegExp(searchTerm, 'i') } },
                                    100,
                                    0
                                ]
                            }
                        ]
                    },
                    matchLength: { $strLenCP: "$name" }  // Add name length for better sorting
                }
            },
            { 
                $sort: {
                    score: -1,
                    matchLength: 1  // Secondary sort by name length (shorter names first)
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
    } finally {
        await client.close();
    }
};

module.exports = { getEatPage, eatScreenSearchName, getMeal ,searchGroceries}