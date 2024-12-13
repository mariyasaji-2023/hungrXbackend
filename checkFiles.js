// router.post('/create-payment-intent', async (req, res) => {
//     const { amount, currency } = req.body; // Accept the amount and currency in the request body
    
//     try {
//       const paymentIntent = await stripe.paymentIntents.create({
//         amount, // Amount in the smallest currency unit (e.g., cents for USD)
//         currency,
//       });
  
//       res.status(200).send({
//         clientSecret: paymentIntent.client_secret,
//       });
//     } catch (error) {
//       res.status(500).send({ error: error.message });
//     }
//   });
  
const addConsumedFood = async (req, res) => {
    try {
        const db = getDBInstance();
        const users = db.collection("users");
        const groceries = db.collection("grocerys");

        const {
            userId,
            mealType,
            servingSize,
            selectedMeal,
            dishId,
            totalCalories
        } = req.body;

        // Get food details from groceries collection
        const foodDetails = await groceries.findOne({ _id: new mongoose.Types.ObjectId(dishId) });
        if (!foodDetails) {
            return res.status(404).json({ error: 'Food item not found in grocery database' });
        }

        const today = new Date();
        const date = today.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '/');

        const validMealIds = {
            'breakfast': '6746a024a45e4d9e5d58ea12',
            'lunch': '6746a024a45e4d9e5d58ea13',
            'dinner': '6746a024a45e4d9e5d58ea14',
            'snacks': '6746a024a45e4d9e5d58ea15'
        };

        if (!validMealIds[mealType.toLowerCase()]) {
            return res.status(400).json({ error: 'Invalid meal type' });
        }

        // Get current user and initialize if needed
        let currentUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Initialize consumedFood structure if it doesn't exist
        if (!currentUser.consumedFood) {
            await users.updateOne(
                { _id: new mongoose.Types.ObjectId(userId) },
                {
                    $setOnInsert: {
                        consumedFood: {
                            dates: {}
                        }
                    }
                },
                { upsert: true }
            );
        }

        // Initialize date structure if it doesn't exist
        if (!currentUser.consumedFood?.dates?.[date]) {
            await users.updateOne(
                { _id: new mongoose.Types.ObjectId(userId) },
                {
                    $set: {
                        [`consumedFood.dates.${date}`]: {
                            breakfast: { mealId: validMealIds['breakfast'], foods: [] },
                            lunch: { mealId: validMealIds['lunch'], foods: [] },
                            dinner: { mealId: validMealIds['dinner'], foods: [] },
                            snacks: { mealId: validMealIds['snacks'], foods: [] }
                        }
                    }
                }
            );
        }

        const foodEntry = {
            servingSize: Number(servingSize),
            selectedMeal: new mongoose.Types.ObjectId(selectedMeal),
            dishId: new mongoose.Types.ObjectId(dishId),
            totalCalories: Number(totalCalories),
            timestamp: today,
            name: foodDetails.name,
            brandName: foodDetails.brandName,
            image: foodDetails.image,
            nutritionFacts: foodDetails.nutritionFacts,
            servingInfo: foodDetails.servingInfo,
            foodId: new mongoose.Types.ObjectId()
        };

        // Calculate calories
        const currentDayCalories = calculateDayTotalCalories(currentUser.consumedFood?.dates?.[date]);
        const newTotalCalories = currentDayCalories + Number(totalCalories);
        const currentCalories = parseInt(currentUser.caloriesToReachGoal) || 0;
        const newCaloriesToReachGoal = currentCalories - Number(totalCalories);

        // Update with new food entry
        const result = await users.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $addToSet: {
                    [`consumedFood.dates.${date}.${mealType.toLowerCase()}.foods`]: foodEntry
                },
                $set: {
                    caloriesToReachGoal: newCaloriesToReachGoal
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        const updatedMeal = updatedUser.consumedFood.dates[date][mealType.toLowerCase()];
        const remainingCalories = parseInt(updatedUser.dailyCalorieGoal) - newTotalCalories;

        res.status(200).json({
            success: true,
            message: 'Consumed food added successfully',
            date: date,
            mealId: selectedMeal,
            foodDetails: {
                id: dishId,
                ...foodDetails,
                mealType: mealType.toLowerCase(),
                mealId: validMealIds[mealType.toLowerCase()]
            },
            updatedMeal: updatedMeal,
            updatedCalories: {
                remaining: remainingCalories,
                consumed: newTotalCalories,
                caloriesToReachGoal: newCaloriesToReachGoal
            }
        });
    } catch (error) {
        console.error('Error adding consumed food:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addUnknownFood = async (req, res) => {
    try {
        const db = getDBInstance();
        const users = db.collection("users");
        const groceries = db.collection("groceries");

        const {
            userId,
            mealType,
            foodName,
            calories
        } = req.body;

        const today = new Date();
        const date = today.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '/');

        const unknownFoodId = new mongoose.Types.ObjectId();

        const mealTypeMapping = {
            '6746a024a45e4d9e5d58ea12': 'breakfast',
            '6746a024a45e4d9e5d58ea13': 'lunch',
            '6746a024a45e4d9e5d58ea14': 'dinner',
            '6746a024a45e4d9e5d58ea15': 'snacks'
        };

        const mealTypeName = mealTypeMapping[mealType];
        if (!mealTypeName) {
            return res.status(400).json({ error: 'Invalid meal type ID' });
        }

        // Create a new food entry in groceries collection
        const newGroceryItem = {
            _id: unknownFoodId,
            name: foodName,
            brandName: "Custom Food",
            nutritionFacts: {
                calories: Number(calories)
            },
            servingInfo: {
                size: 1,
                unit: "serving"
            },
            isCustomFood: true
        };

        await groceries.insertOne(newGroceryItem);

        // Get current user and initialize if needed
        let currentUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Initialize consumedFood structure if it doesn't exist
        if (!currentUser.consumedFood) {
            await users.updateOne(
                { _id: new mongoose.Types.ObjectId(userId) },
                {
                    $setOnInsert: {
                        consumedFood: {
                            dates: {}
                        }
                    }
                },
                { upsert: true }
            );
        }

        // Initialize date structure if it doesn't exist
        if (!currentUser.consumedFood?.dates?.[date]) {
            await users.updateOne(
                { _id: new mongoose.Types.ObjectId(userId) },
                {
                    $set: {
                        [`consumedFood.dates.${date}`]: {
                            breakfast: { mealId: '6746a024a45e4d9e5d58ea12', foods: [] },
                            lunch: { mealId: '6746a024a45e4d9e5d58ea13', foods: [] },
                            dinner: { mealId: '6746a024a45e4d9e5d58ea14', foods: [] },
                            snacks: { mealId: '6746a024a45e4d9e5d58ea15', foods: [] }
                        }
                    }
                }
            );
        }

        const foodEntry = {
            servingSize: 1,
            selectedMeal: new mongoose.Types.ObjectId(mealType),
            dishId: unknownFoodId,
            totalCalories: Number(calories),
            timestamp: today,
            name: foodName,
            brandName: "Custom Food",
            nutritionFacts: {
                calories: Number(calories)
            },
            servingInfo: {
                size: 1,
                unit: "serving"
            },
            isCustomFood: true,
            foodId: new mongoose.Types.ObjectId()
        };

        // Calculate calories
        const currentDayCalories = calculateDayTotalCalories(currentUser.consumedFood?.dates?.[date]);
        const newTotalCalories = currentDayCalories + Number(calories);
        const currentCalories = parseInt(currentUser.caloriesToReachGoal) || 0;
        const newCaloriesToReachGoal = currentCalories - Number(calories);

        // Update with new food entry
        const result = await users.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $addToSet: {
                    [`consumedFood.dates.${date}.${mealTypeName}.foods`]: foodEntry
                },
                $set: {
                    caloriesToReachGoal: newCaloriesToReachGoal
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        const updatedMeal = updatedUser.consumedFood.dates[date][mealTypeName];
        const remainingCalories = parseInt(updatedUser.dailyCalorieGoal) - newTotalCalories;

        res.status(200).json({
            success: true,
            message: 'Unknown food added successfully',
            date: date,
            mealId: mealType,
            foodDetails: {
                id: unknownFoodId,
                ...newGroceryItem,
                mealType: mealTypeName,
                mealId: mealType
            },
            updatedMeal: updatedMeal,
            updatedCalories: {
                remaining: remainingCalories,
                consumed: newTotalCalories,
                caloriesToReachGoal: newCaloriesToReachGoal
            }
        });

    } catch (error) {
        console.error('Error adding unknown food:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Helper function to calculate total calories for a day
const calculateDayTotalCalories = (dateData) => {
    if (!dateData) return 0;
    
    let totalCalories = 0;
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    mealTypes.forEach(mealType => {
        if (dateData[mealType] && dateData[mealType].foods) {
            totalCalories += dateData[mealType].foods.reduce((sum, food) => 
                sum + (food.totalCalories || 0), 0);
        }
    });
    
    return totalCalories;
};

module.exports = {
    addConsumedFood,
    addUnknownFood
};
