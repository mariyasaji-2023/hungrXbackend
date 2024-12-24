const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.DB_URI);
const { ObjectId } = require('mongodb');

const getMenu = async (req, res) => {
    const { restaurantId, userId } = req.body;
    
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const restaurant = db.collection("restaurants");
        const User = db.collection("users");

        const user = await User.findOne(
            { _id: new ObjectId(userId) },
            {
                projection: {
                    dailyCalorieGoal: 1,
                    dailyConsumptionStats: 1
                }
            }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const menu = await restaurant.findOne(
            { _id: new ObjectId(restaurantId) },
            { 
                projection: {
                    restaurantName: 1,
                    logo: 1,
                    categories: 1
                }
            }
        );
        
        if (!menu) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found"
            });
        }

        // Ensure categories array exists and process each category
        const processedMenu = {
            ...menu,
            categories: menu.categories?.map(category => ({
                ...category,
                subCategories: category.subCategories || []
            })) || []
        };
        
        return res.status(200).json({
            success: true,
            menu: processedMenu,
            userStats: {
                dailyCalorieGoal: user.dailyCalorieGoal,
                dailyConsumptionStats: user.dailyConsumptionStats
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error retrieving menu",
            error: error.message
        });
    } finally {
        await client.close();
    }
};

module.exports = {getMenu}