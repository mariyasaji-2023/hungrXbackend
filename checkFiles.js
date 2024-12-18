const searchRestaurant = async (req, res) => {
    const { userId, name } = req.body;

    try {
        // Validate inputs
        if (!userId || !name) {
            return res.status(400).json({
                status: false,
                message: 'Missing required fields'
            });
        }

        // Check if user exists
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(400).json({
                status: false,
                message: 'User not found'
            });
        }

        // Process search term
        const searchTerm = name.trim().toLowerCase();

        // Get restaurants collection
        const restaurantsCollection = mongoose.connection.db.collection("restaurants");
        
        // Search for restaurant using case-insensitive regex
        const restaurant = await restaurantsCollection.findOne({
            name: { $regex: searchTerm, $options: 'i' }
        });

        if (!restaurant) {
            return res.status(404).json({
                status: false,
                message: 'Restaurant not found'
            });
        }

        // Return success response with restaurant data
        return res.status(200).json({
            status: true,
            message: 'Restaurant found',
            data: {
                id: restaurant._id,
                name: restaurant.name,
                logo: restaurant.logo,
                menus: restaurant.menus
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