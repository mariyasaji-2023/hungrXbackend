
const getCart = async (req, res) => {
    const { userId } = req.body;
    
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const cartCollection = db.collection("cartDetails");
        
        // Using find() instead of findOne() to get all matching documents
        const carts = await cartCollection.find({ userId: userId }).toArray();
        const user = await User.findOne({_id: userId});

        // Convert Map to regular object
        const dailyConsumption = user?.dailyConsumptionStats ? 
            Object.fromEntries(user.dailyConsumptionStats) : {};
            const value = Object.values(dailyConsumption)[0]||0
        const dailyCalorieGoal = user?.dailyCalorieGoal  
        const remaining = dailyCalorieGoal - value
        console.log(value,dailyCalorieGoal,remaining, "///////////////");
        
        if (!carts.length) {
            return res.status(404).json({
                success: true,
                message: 'No carts found for this user',
                data: null,
                remaining
            });
        }
        
        // Return all cart documents
        res.status(200).json({
            success: true,
            message: 'Carts fetched successfully',
            data: carts.map(cart => ({
                cartId: cart._id,
                orders: cart.orders,
                dishDetails: cart.dishDetails,
                createdAt: cart.createdAt
            })),
            remaining
        });
        
    } catch (error) {
        console.error('Error fetching carts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching carts',
            error: error.message
        });
    } finally {
        await client.close();
    }
};

const removeOneItem = async (req, res) => {
    const { cartId, restaurantId, dishId } = req.body;
    
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const cartCollection = db.collection("cartDetails");

        // Find the cart
        const cart = await cartCollection.findOne({ 
            _id: new ObjectId(cartId) 
        });

        if (!cart) {
            return res.status(404).json({ 
                status: false, 
                message: "Cart not found" 
            });
        }

        // Update orders array
        const updatedOrders = cart.orders.map(order => {
            if (order.restaurantId === restaurantId) {
                // Filter out the specified dish
                order.items = order.items.filter(item => 
                    item.dishId !== dishId
                );
            }
            return order;
        });

        // Remove empty restaurant orders
        const filteredOrders = updatedOrders.filter(order => 
            order.items.length > 0
        );

        // Update dishDetails array
        const updatedDishDetails = cart.dishDetails.filter(dish => 
            dish.dishId !== dishId
        );

        // Update the cart in database
        const result = await cartCollection.updateOne(
            { _id: new ObjectId(cartId) },
            {
                $set: {
                    orders: filteredOrders,
                    dishDetails: updatedDishDetails,
                    updatedAt: new Date(),
                    message: "Item removed from cart successfully"
                }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(400).json({
                status: false,
                message: "Failed to remove item from cart"
            });
        }

        res.status(200).json({
            status: true,
            message: "Item removed from cart successfully"
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Error removing item from cart",
            error: error.message
        });
    } finally {
        await client.close();
    }
};