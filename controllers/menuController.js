const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.DB_URI);
const { ObjectId } = require('mongodb');

const getMenu = async (req, res) => {
    const { restaurantId } = req.body;
    
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const restaurant = db.collection("restaurants");
        
        const menu = await restaurant.findOne(
            { _id: new ObjectId(restaurantId) },
            { projection: {
                restaurantName: 1,
                logo: 1,
                categories: 1
            }}
        );
        
        if (!menu) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            menu
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error retrieving menu",
            error: error.message
        });
    } finally {
        // Close the connection
        await client.close();
    }
};

module.exports = {getMenu}