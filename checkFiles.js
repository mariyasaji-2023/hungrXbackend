const { reqrestaurant } = require("./controllers/restaurantController")

const suggestions = async (req, res) => {
    try {
        await client.connect()
        const db = client.db(process.env.DB_NAME)
        const filteredRestaurants = restaurants.filter(restaurant => {
            return restaurant.logo &&
                (restaurant.logo.statswith("http://") ||
                    restaurant.logo.statswith("https://"))
        })
        return res.status(201).json({
            status:true,
            data:{
                message:'Submitted successfull',
                reqrestaurant
            }
        })
    } catch (error) {
        return res.status(500).json({
            status:false,
            message:'Internal server error'
        })
    }
}