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
                    quantity: item.quantity || 1, // Default to 1 if quantity not provided
                    nutritionInfo: servingInfo.servingInfo.nutritionFacts,
                    url: servingInfo.servingInfo.Url
                };
            }).filter(Boolean);
        });

        if (allDishDetails.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'No valid dishes found in the order'
            });
        }

        const existingCart = await cartCollection.findOne({ userId });

        if (existingCart) {
            const mergedOrders = [...existingCart.orders];

            orders.forEach(newOrder => {
                const existingOrderIndex = mergedOrders.findIndex(
                    order => order.restaurantId === newOrder.restaurantId
                );

                if (existingOrderIndex !== -1) {
                    // Merge items for the same restaurant
                    newOrder.items.forEach(newItem => {
                        const existingItemIndex = mergedOrders[existingOrderIndex].items.findIndex(
                            item => item.dishId === newItem.dishId && item.servingSize === newItem.servingSize
                        );

                        if (existingItemIndex !== -1) {
                            // Update quantity if item exists
                            mergedOrders[existingOrderIndex].items[existingItemIndex].quantity =
                                (mergedOrders[existingOrderIndex].items[existingItemIndex].quantity || 1) +
                                (newItem.quantity || 1);
                        } else {
                            // Add new item
                            mergedOrders[existingOrderIndex].items.push({
                                ...newItem,
                                quantity: newItem.quantity || 1
                            });
                        }
                    });
                } else {
                    // Add new restaurant order with quantities
                    mergedOrders.push({
                        ...newOrder,
                        items: newOrder.items.map(item => ({
                            ...item,
                            quantity: item.quantity || 1
                        }))
                    });
                }
            });

            // Merge dish details with quantity handling
            const mergedDishDetails = [...existingCart.dishDetails];
            allDishDetails.forEach(newDish => {
                const existingDishIndex = mergedDishDetails.findIndex(
                    dish => dish.dishId === newDish.dishId && dish.servingSize === newDish.servingSize
                );

                if (existingDishIndex !== -1) {
                    // Update quantity for existing dish
                    mergedDishDetails[existingDishIndex].quantity =
                        (mergedDishDetails[existingDishIndex].quantity || 1) +
                        (newDish.quantity || 1);
                } else {
                    // Add new dish
                    mergedDishDetails.push(newDish);
                }
            });

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
                orders: orders.map(order => ({
                    ...order,
                    items: order.items.map(item => ({
                        ...item,
                        quantity: item.quantity || 1
                    }))
                })),
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
    const { userId, mealType, orderDetails } = req.body;

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

    if (!orderDetails || !Array.isArray(orderDetails)) {
        return res.status(400).json({
            status: false,
            message: 'orderDetails array required with dish quantities'
        });
    }

    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const cartCollection = db.collection("cartDetails");
        const users = db.collection("users");

        // Get current user for timezone and calorie calculations
        const currentUser = await users.findOne({ _id: new ObjectId(userId) });
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

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

        // Get user's timezone
        const userTimezone = currentUser.timezone || 'America/New_York';

        // Create timestamp and format date in user's timezone
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: userTimezone,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        // Get the date in DD/MM/YYYY format
        const date = formatter.format(now);

        // Create UTC timestamp for storage
        const timestamp = now.toISOString();

        // Prepare update operations for user's consumed food
        const dateKey = `consumedFood.dates.${date}`;
        const statsDateKey = `dailyConsumptionStats.${date}`;

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

        // Process each dish with its quantity from cart.dishDetails
        for (const dish of cart.dishDetails) {
            const quantity = dish.quantity || 1;
            const caloriesPerServing = Number(dish.nutritionInfo.calories.value);
            const totalCaloriesForDish = caloriesPerServing * quantity;

            const foodEntry = {
                servingSize: dish.servingSize,
                selectedMeal: validMealIds[mealType.toLowerCase()],
                dishId: new ObjectId(dish.dishId),
                totalCalories: totalCaloriesForDish,
                timestamp: timestamp,
                name: dish.dishName.trim(),
                brandName: dish.restaurantName,
                nutritionFacts: {
                    calories: totalCaloriesForDish,
                    protein: Number(dish.nutritionInfo.protein.value) * quantity,
                    carbs: Number(dish.nutritionInfo.carbs.value) * quantity,
                    fat: Number(dish.nutritionInfo.totalFat.value) * quantity
                },
                servingInfo: {
                    size: dish.servingSize,
                    unit: dish.nutritionInfo.calories.unit,
                    quantity: quantity
                },
                foodId: new ObjectId()
            };

            foodEntries.push(foodEntry);
            totalNewCalories += totalCaloriesForDish;
        }

        const currentCalories = currentUser.dailyConsumptionStats?.[date] || 0;
        const newTotalCalories = currentCalories + totalNewCalories;
        const dailyCalorieGoal = currentUser.dailyCalorieGoal || 0;

        await users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $push: {
                    [`${dateKey}.${mealType.toLowerCase()}.foods`]: { $each: foodEntries }
                },
                $set: {
                    [statsDateKey]: newTotalCalories
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
                    consumed: dailyCalories
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

        const today = new Date().toLocaleDateString('en-GB');

        const value = user?.dailyConsumptionStats?.get(today) || 0;

        // console.log('Today\'s date:', today);
        // console.log('Daily consumption stats:', user?.dailyConsumptionStats);

        const dailyCalorieGoal = user?.dailyCalorieGoal;
        const remaining = dailyCalorieGoal - value;
        // console.log(value, dailyCalorieGoal, remaining);

        if (!carts.length) {
            return res.status(404).json({
                success: true,
                message: 'No carts found for this user',
                data: null,
                remaining
            });
        }

        res.status(200).json({
            success: true,
            message: 'Carts fetched successfully',
            data: carts.map(cart => ({
                quantity: cart.quantity,
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
    const { cartId, restaurantId, dishId, servingSize } = req.body; // Added servingSize

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
                // Filter out the specified dish with matching serving size
                order.items = order.items.filter(item =>
                    !(item.dishId === dishId && item.servingSize === servingSize)
                );
            }
            return order;
        });

        const filteredOrders = updatedOrders.filter(order =>
            order.items.length > 0
        );

        // Filter dishDetails based on both dishId and servingSize
        const updatedDishDetails = cart.dishDetails.filter(dish =>
            !(dish.dishId === dishId && dish.servingSize === servingSize)
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