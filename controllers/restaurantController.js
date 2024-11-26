const userModel = require('../models/userModel')
const profileModel = require('../models/profileModel')

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
             profilePhoto = user.gender == 'female'?profile.female:profile.male
        } catch (error) {
            console.log('Error fetching profile photo:',error);
            
        }

        const { name, dailyCalorieGoal } = user
        if (!name || !dailyCalorieGoal ) {
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
            }
        ]).toArray();

        if (!results || results.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'No matching items found'
            });
        }

        // Transform the results to include type information
        const transformedResults = results.map(item => {
            // Check if it's a restaurant (has menus array) or grocery item
            const type = item.menus ? 'restaurant' : 'grocery';
            
            if (type === 'restaurant') {
                return {
                    type,
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

module.exports = { getEatPage,eatScreenSearchName }