const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DB_URI);
const User = require('../models/userModel');
const { ObjectId } = require('mongodb');

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
    const { userId, mealType } = req.body;

    if (!userId) {
        return res.status(400).json({
            status: false,
            message: 'userId required'
        });
    }

    if (!mealType) {
        return res.status(400).json({
            status: false,
            message: 'mealType required'
        });
    }

    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const cartCollection = db.collection("cartDetails");
        const users = db.collection("users");

        // Get cart items before deletion
        const cart = await cartCollection.findOne({ userId });
        if (!cart || !cart.orders || !cart.dishDetails || cart.dishDetails.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Cart not found or empty'
            });
        }

        // Valid meal type check
        const validMealIds = {
            'breakfast': '6746a024a45e4d9e5d58ea12',
            'lunch': '6746a024a45e4d9e5d58ea13',
            'dinner': '6746a024a45e4d9e5d58ea14',
            'snacks': '6746a024a45e4d9e5d58ea15'
        };

        if (!validMealIds[mealType.toLowerCase()]) {
            return res.status(400).json({ error: 'Invalid meal type' });
        }

        // Get current date in required format
        const today = new Date();
        const date = today.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '/');

        // Prepare update operations for user's consumed food
        const dateKey = `consumedFood.dates.${date}`;
        const statsDateKey = `dailyConsumptionStats.${date}`;

        // Get current user for calorie calculations
        const currentUser = await users.findOne({ _id: new ObjectId(userId) });
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentDayData = currentUser.consumedFood?.dates?.[date];
        if (!currentDayData?.[mealType.toLowerCase()]) {
            await users.updateOne(
                { _id: new ObjectId(userId) },
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

        let totalNewCalories = 0;
        const foodEntries = [];

        for (const dish of cart.dishDetails) {
            const foodEntry = {
                servingSize: dish.servingSize,
                selectedMeal: validMealIds[mealType.toLowerCase()],
                dishId: new ObjectId(dish.dishId),
                totalCalories: Number(dish.nutritionInfo.calories.value),
                timestamp: today,
                name: dish.dishName.trim(),
                brandName: dish.restaurantName,
                // image: dish.image || null,
                nutritionFacts: {
                    calories: Number(dish.nutritionInfo.calories.value),
                    protein: Number(dish.nutritionInfo.protein.value),
                    carbs: Number(dish.nutritionInfo.carbs.value),
                    fat: Number(dish.nutritionInfo.totalFat.value)
                },
                servingInfo: {
                    size: dish.servingSize,
                    unit: dish.nutritionInfo.calories.unit
                },
                foodId: new ObjectId()
            };

            foodEntries.push(foodEntry);
            totalNewCalories += Number(dish.nutritionInfo.calories.value);
        }

        const currentCalories = currentUser.dailyConsumptionStats?.[date] || 0;
        const newTotalCalories = currentCalories + totalNewCalories;
        const dailyCalorieGoal = currentUser.dailyCalorieGoal || 0;
        const newCaloriesToReachGoal = dailyCalorieGoal - newTotalCalories;

        await users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $push: {
                    [`${dateKey}.${mealType.toLowerCase()}.foods`]: { $each: foodEntries }
                },
                $set: {
                    [statsDateKey]: newTotalCalories,
                    caloriesToReachGoal: newCaloriesToReachGoal
                }
            }
        );

        const result = await cartCollection.deleteOne({ userId });

        if (result.deletedCount > 0) {
            const updatedUser = await users.findOne({ _id: new ObjectId(userId) });
            const updatedMeal = updatedUser.consumedFood.dates[date][mealType.toLowerCase()];
            const dailyCalories = updatedUser.dailyConsumptionStats[date];

            res.status(200).json({
                status: true,
                message: 'Cart items added to consumed food and cart removed successfully',
                date: date,
                updatedMeal: updatedMeal,
                dailyCalories: dailyCalories,
                updatedCalories: {
                    remaining: dailyCalorieGoal - dailyCalories,
                    consumed: dailyCalories,
                    caloriesToReachGoal: newCaloriesToReachGoal
                }
            });
        } else {
            res.status(404).json({
                status: false,
                message: 'Cart not found for this user'
            });
        }
    } catch (error) {
        console.error("Error processing cart removal:", error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        await client.close();
    }
};


const getCart = async (req, res) => {
    const { userId } = req.body;

    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const cartCollection = db.collection("cartDetails");

        const carts = await cartCollection.find({ userId: userId }).toArray();
        const user = await User.findOne({ _id: userId });

        // Generate today's date in the format that matches your dailyConsumptionStats keys
        const today = new Date().toISOString().split('T')[0]; // Format: 'YYYY-MM-DD'
        
        const dailyConsumption = user?.dailyConsumptionStats ?
            Object.fromEntries(user.dailyConsumptionStats) : {};
        const value = dailyConsumption[today] || 0;
        const dailyCalorieGoal = user?.dailyCalorieGoal;
        const remaining = dailyCalorieGoal - value;
        console.log(value, dailyCalorieGoal, remaining, "///////////////");

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
        const cart = await cartCollection.findOne({
            _id: new ObjectId(cartId)
        });

        if (!cart) {
            return res.status(404).json({
                status: false,
                message: "Cart not found"
            });
        }
        const updatedOrders = cart.orders.map(order => {
            if (order.restaurantId === restaurantId) {
                // Filter out the specified dish
                order.items = order.items.filter(item =>
                    item.dishId !== dishId
                );
            }
            return order;
        });

        const filteredOrders = updatedOrders.filter(order =>
            order.items.length > 0
        );

        const updatedDishDetails = cart.dishDetails.filter(dish =>
            dish.dishId !== dishId
        );

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

module.exports = { addToCart, removeCart, getCart, removeOneItem }