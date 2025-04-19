const { OpenAI } = require("openai");
const Recipe = require("../models/recipeModel"); // Import the Recipe model
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { MongoClient } = require("mongodb")
const { ObjectId } = require("mongodb")
const client = new MongoClient(process.env.DB_URI)
const mongoose = require("mongoose")

const chat = async (req, res) => {
    try {
        const { ingredients, cuisine, calories, cookingTime, userId } = req.body;

        // Build the GPT prompt with bullet points and measurements in ingredients
        const prompt = `
      Generate a ${cuisine} recipe using only ${ingredients.join(', ')}.
      
      * Total cooking time must be exactly ${cookingTime || '5'} minutes
      * The recipe is for one person
      * Total calories: ${calories || '[value]'} calories
      
      ### Format Requirements:
      
      * **Each stage should be presented as a separate card with emojis**
      * **Each stage should be timed accordingly**
      
      ### Stage Format:
      * **Stage:** [stage number]
      * **Title:** [stage_name with emoji]
      * **Time:** [duration in minutes]
      * **description:** [an array of strings, where each item is a step with emoji, measurement, and calories]
      
    + ### Example Step Format (use multiple lines per stage):
 "description": [
   "🥚 Use 1 medium egg (150 calories)",
   "🔄 Crack and whisk the egg."
 ]

 "description": [
  "🍞 Use 2 slices bread (160 calories)",
  "🔥 Toast until golden brown."
]
      
      In JSON:
      "description": [
   "🥚 Use 1 medium egg (150 calories)",
   "🔄 Crack and whisk the egg."
 ]

"description": [
  "🍞 Use 2 slices bread (160 calories)",
  "🔥 Toast until golden brown."
 ]
      
      ### Important Formatting Rules:
      * In the description array:
  * Split each action into a separate string.
  * First line: include the ingredient, emoji, measurement, and calories.
  * Next line(s): describe what to do with that ingredient.
      * Stages should progress logically from preparation to final plating, card by card
      * For each ingredient, place the emoji BEFORE the ingredient name in the ingredients list
      * In the ingredients list, include measurements within the description:
        * 🥚 Egg (150 cal)(1 medium egg)
        * 🍞 Bread (160 cal)(2 slices bread)
      
      ### Measurement Guidelines:
      * Use kitchen utensils for measurement (cups, tablespoons, teaspoons)
      * Calculate ingredient measurements precisely to match the total calories of ${calories || '[value]'}
      * Show the calorie count for each ingredient in parentheses
      
      ### Required Nutritional Info (per serving):
      * Calories: ${calories || '[value]'}
      * Protein: [value]g
      * Carbs: [value]g
      * Fat: [value]g
      
      Return JSON format:
      \\\`
      {
        "recipe_name": "",
        "total_time": ${cookingTime || 5},
        "stages": [
          {
            "Step": "1",
            "Title": "",
            "description": [
              "🥚 Use 1 medium egg (150 calories): crack and whisk.",
              "🍞 Use 2 slices bread (160 calories): toast slices."
            ],
            "duration": 0
          }
          // etc...
        ],
        "nutrition": {
          "calories": ${calories || 0},
          "protein": 0,
          "carbs": 0,
          "fat": 0
        },
        "ingredients": [
          "🥚 Egg (150 cal)(1 medium egg)",
          "🍞 Bread (160 cal)(2 slices bread)",
          "🌱 Mixed Spices (80 cal)(1 tablespoon mixed spices)",
          "🥥 Cooking Oil (not counted directly in calories)(1 teaspoon oil)"
        ]
      }
      \\\`
      `.trim();

        // Call the OpenAI API
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });

        const content = response.choices[0].message.content;

        // Try to parse out JSON
        let recipeData;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            recipeData = JSON.parse(jsonMatch ? jsonMatch[0] : content);
        } catch (parseErr) {
            console.error("Failed to parse JSON:", parseErr);
            return res.json({
                reply: content,
                requested_cooking_time: cookingTime || 5,
            });
        }

        // Recalculate total_time from stages
        const calculatedTotal = recipeData.stages.reduce(
            (sum, stage) => sum + (stage.duration || 0),
            0
        );
        if (recipeData.total_time !== calculatedTotal) {
            console.log(
                `Correcting total_time from ${recipeData.total_time} to ${calculatedTotal}`
            );
            recipeData.total_time = calculatedTotal;
        }

        // Ensure no stray total_time_minutes
        delete recipeData.total_time_minutes;

        // Persist to MongoDB
        const newRecipe = new Recipe({
            userId: userId || null,
            recipe_name: recipeData.recipe_name,
            total_time: recipeData.total_time,
            stages: recipeData.stages,
            nutrition: recipeData.nutrition,
            ingredients: recipeData.ingredients,
            cuisine,
        });
        await newRecipe.save();

        // Return the saved object
        res.json(newRecipe);

    } catch (error) {
        console.error("chat handler error:", error);
        res.status(500).json({ error: "Something went wrong!" });
    }
};

const recipeHistory = async (req, res) => {
    const { userId } = req.body;

    try {
        // Use find instead of findOne to get all recipes with matching userId
        const recipes = await Recipe.find({ userId: userId });

        if (!recipes || recipes.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'No recipes found for this user'
            });
        }

        // Map the recipes to include only the necessary fields
        const recipeData = recipes.map(recipe => ({
            _id: recipe._id,
            recipe_name: recipe.recipe_name,
            nutrition: recipe.nutrition,
            total_time: recipe.total_time,
            cuisine: recipe.cuisine,
            createdAt: recipe.createdAt
        }));

        return res.status(200).json({
            status: true,
            message: 'Recipe history retrieved successfully',
            count: recipes.length,
            recipes: recipeData
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};

const recipeHistoryDetails = async (req, res) => {
    const { recipeId } = req.body
    try {
        const recipe = await Recipe.findOne({ _id: recipeId })
        if (!recipe) {
            return res.status(404).json({
                status: false,
                message: 'Recipe not found'
            })
        }
        return res.status(200).json({
            status: false,
            recipe
        })
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        })
    }
}

const recordRecipeConsumption = async (req, res) => {
    try {
        const db = client.db(process.env.DB_NAME); // Use your database name from env
        const users = db.collection("users");
        const recipes = db.collection("recipes");

        const {
            userId,
            mealType,
            servingSize,
            selectedMeal,
            recipeId,
        } = req.body;

        const recipeDetails = await recipes.findOne({ _id: new mongoose.Types.ObjectId(recipeId) });
        if (!recipeDetails) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        // Get user's timezone from the database
        const currentUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }
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

        const validMealIds = {
            'breakfast': '6746a024a45e4d9e5d58ea12',
            'lunch': '6746a024a45e4d9e5d58ea13',
            'dinner': '6746a024a45e4d9e5d58ea14',
            'snacks': '6746a024a45e4d9e5d58ea15'
        };

        if (!validMealIds[mealType.toLowerCase()]) {
            return res.status(400).json({ error: 'Invalid meal type' });
        }

        // Calculate total calories based on recipe nutrition info and serving size
        const totalCalories = recipeDetails.nutrition && recipeDetails.nutrition.calories
            ? Math.round(recipeDetails.nutrition.calories * Number(servingSize))
            : 0;

        const dateKey = `consumedFood.dates.${date}`;
        const statsDateKey = `dailyConsumptionStats.${date}`;
        const mealKey = `${dateKey}.${mealType.toLowerCase()}`;

        const foodEntry = {
            servingSize: Number(servingSize),
            selectedMeal: new mongoose.Types.ObjectId(selectedMeal),
            recipeId: new mongoose.Types.ObjectId(recipeId),
            totalCalories: totalCalories,
            timestamp: timestamp,
            name: recipeDetails.recipe_name,
            ingredients: recipeDetails.ingredients,
            cuisine: recipeDetails.cuisine,
            nutritionFacts: recipeDetails.nutrition,
            total_time: recipeDetails.total_time,
            isRecipe: true,
            foodId: new mongoose.Types.ObjectId()
        };

        const currentDayData = currentUser.consumedFood?.dates?.[date];
        if (!currentDayData?.[mealType.toLowerCase()]) {
            await users.updateOne(
                { _id: new mongoose.Types.ObjectId(userId) },
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

        const currentCalories = currentUser.dailyConsumptionStats?.[date] || 0;
        const newTotalCalories = currentCalories + totalCalories;
        const dailyCalorieGoal = currentUser.dailyCalorieGoal || 0;

        const result = await users.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $push: {
                    [`${dateKey}.${mealType.toLowerCase()}.foods`]: foodEntry
                },
                $set: {
                    [statsDateKey]: newTotalCalories
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
        const updatedMeal = updatedUser.consumedFood.dates[date][mealType.toLowerCase()];
        const dailyCalories = updatedUser.dailyConsumptionStats[date];
        const updatedCaloriesToReachGoal = updatedUser.caloriesToReachGoal;

        res.status(200).json({
            success: true,
            message: 'Recipe consumption recorded successfully',
            date: date,
            mealId: selectedMeal,

        });
    } catch (error) {
        console.error('Error recording recipe consumption:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { chat, recipeHistory, recipeHistoryDetails, recordRecipeConsumption };
