const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DB_URI);
const User = require('../models/userModel');

const addToCart = async (req, res) => {
    const { userId, orders } = req.body;

    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const cartCollection = db.collection("cartDetails");
        const restaurantCollection = db.collection("restaurants");
        const restaurants = await restaurantCollection.find({}).toArray();

        const findDishInRestaurant = (restaurants, targetDishId) => {
            for (const restaurant of restaurants) {
                for (const category of restaurant.categories) {
                    if (category.dishes && category.dishes.length > 0) {
                        const mainDish = category.dishes.find(dish => {
                            const dishId = dish._id.toString ? dish._id.toString() : dish._id.$oid;
                            return dishId === targetDishId;
                        });

                        if (mainDish) {
                            return {
                                dish: mainDish,
                                restaurant,
                                categoryName: category.categoryName
                            };
                        }
                    }

                    if (category.subCategories) {
                        for (const subCategory of category.subCategories) {
                            const subDish = subCategory.dishes.find(dish => {
                                const dishId = dish._id.toString ? dish._id.toString() : dish._id.$oid;
                                return dishId === targetDishId;
                            });

                            if (subDish) {
                                return {
                                    dish: subDish,
                                    restaurant,
                                    categoryName: category.categoryName,
                                    subCategoryName: subCategory.subCategoryName
                                };
                            }
                        }
                    }
                }
            }
            return null;
        };

        const allDishDetails = orders.flatMap(order => {
            return order.items.map(item => {
                const restaurantData = findDishInRestaurant(restaurants, item.dishId);

                if (!restaurantData) {
                    console.log('No restaurant data found for dishId:', item.dishId);
                    return null;
                }

                const { dish, restaurant, categoryName, subCategoryName } = restaurantData;
                const servingInfo = dish.servingInfos.find(info =>
                    info.servingInfo.size === item.servingSize
                );

                if (!servingInfo) {
                    console.log('No serving info found for size:', item.servingSize);
                    return null;
                }

                return {
                    restaurantId: order.restaurantId,
                    restaurantName: restaurant.restaurantName,
                    categoryName,
                    subCategoryName,
                    dishId: item.dishId,
                    dishName: dish.dishName,
                    servingSize: item.servingSize,
                    nutritionInfo: servingInfo.servingInfo.nutritionFacts,
                };
            }).filter(Boolean);
        });

        if (allDishDetails.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'No valid dishes found in the order'
            });
        }

        // Find existing cart for the user
        const existingCart = await cartCollection.findOne({ userId });

        if (existingCart) {
            // Merge existing and new orders
            const mergedOrders = [...existingCart.orders];
            
            orders.forEach(newOrder => {
                const existingOrderIndex = mergedOrders.findIndex(
                    order => order.restaurantId === newOrder.restaurantId
                );

                if (existingOrderIndex !== -1) {
                    // Restaurant exists in cart, append new items
                    mergedOrders[existingOrderIndex].items = [
                        ...mergedOrders[existingOrderIndex].items,
                        ...newOrder.items
                    ];
                } else {
                    // New restaurant, add entire order
                    mergedOrders.push(newOrder);
                }
            });

            // Merge dish details
            const mergedDishDetails = [
                ...existingCart.dishDetails,
                ...allDishDetails
            ];

            // Update existing cart with merged data
            const updatedCart = {
                userId,
                orders: mergedOrders,
                dishDetails: mergedDishDetails,
                updatedAt: new Date(),
                status: true,
                message: 'Cart updated successfully'
            };

            await cartCollection.updateOne(
                { userId },
                { $set: updatedCart }
            );

            return res.status(200).json({
                status: true,
                message: 'Cart updated successfully',
                dishes: mergedDishDetails
            });
        } else {
            // Create new cart if none exists
            const newCart = {
                userId,
                orders,
                dishDetails: allDishDetails,
                createdAt: new Date(),
                updatedAt: new Date(),
                status: true,
                message: 'Cart created successfully'
            };

            await cartCollection.insertOne(newCart);

            return res.status(200).json({
                status: true,
                message: 'Cart created successfully',
                dishes: allDishDetails
            });
        }

    } catch (error) {
        console.error('Error in addToCart:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    } finally {
        await client.close();
    }
};

const removeCart = async (req, res) => {
    const { userId } = req.body
    if (!userId) {
        return res.status(400).json({
            status: false,
            message: 'userId required'
        })
    }
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME)
        const cartCollection = db.collection("cartDetails")

        const result = await cartCollection.deleteOne({ userId })

        if (result.deletedCount > 0) {
            res.status(200).json({
                status: true,
                message: 'Cart removed successfully'
            })
        } else {
            res.status(404).json({
                status: false,
                message: 'Cart not found for this user'
            })
        }
    } catch (error) {
        console.error("Error removing cart:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        await client.close();
    }
}


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

module.exports = { addToCart, removeCart,getCart }