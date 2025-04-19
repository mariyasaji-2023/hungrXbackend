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

        // Format the prompt
        let prompt = `Generate a ${cuisine} recipe using only ${ingredients.join(', ')}. 
        Total cooking time must be exactly ${cookingTime || '5'} minutes. The recipe is for one person.
        Total calories: ${calories || '[value]'} calories
        
        Each stage should be presented as a separate card with emojis, with each stage timed accordingly.
        Format each stage as follows:
        
        Stage: [stage number] 
        Title: [stage_name with emoji]
        Time: [duration in minutes]
        Steps:
        • [step 1]
        • [step 2]
        • [continue for all steps in this stage]
        
        Stages should progress logically from preparation to final plating, card by card.
        
        IMPORTANT: For each ingredient, place the emoji BEFORE the ingredient name, like this:
        • 🥚 Egg (X calories)
        • 🍚 Rice (X calories)
        
        For measurements:
        - Use kitchen utensils for measurement (cups, tablespoons, teaspoons)
        - Calculate ingredient measurements precisely to match the total calories of ${calories || '[value]'}
        - Show the calorie count for each ingredient in parentheses
        
        Nutritional info (per serving):
        - Calories: ${calories || '[value]'}
        - Protein: [value]g
        - Carbs: [value]g
        - Fat: [value]g
        
        Your response should ONLY contain the JSON with no other text. Return in this format exactly:
        {
          "recipe_name": "Recipe Name",
          "total_time": ${cookingTime || 5},
          "stages": [
            {
              "Step": "1",
              "Title": "Stage Title", 
              "description": "Description of steps",
              "duration": 1
            }
          ],
          "nutrition": {"calories": ${calories || 0}, "protein": 0, "carbs": 0, "fat": 0},
          "ingredients": ["🥚 Egg (75 calories)", "🍚 Rice (130 calories)"]
        }`;
        

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }  // Request JSON format explicitly
        });

        // Parse the response to extract the JSON
        const content = response.choices[0].message.content;
        try {
            // Clean the content before parsing
            let cleanedContent = content.trim();
            
            // Remove markdown code block markers if present
            if (cleanedContent.startsWith("```json")) {
                cleanedContent = cleanedContent.replace(/```json\n|```/g, "");
            } else if (cleanedContent.startsWith("```")) {
                cleanedContent = cleanedContent.replace(/```\n|```/g, "");
            }
            
            // Try to extract JSON if it's not already pure JSON
            if (!cleanedContent.startsWith("{")) {
                const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    cleanedContent = jsonMatch[0];
                }
            }
            
            // Parse the cleaned JSON
            const recipeData = JSON.parse(cleanedContent);

            // Always calculate total time from stages to ensure consistency
            const calculatedTotalTime = recipeData.stages.reduce(
                (total, stage) => total + (Number(stage.duration) || 0),
                0
            );

            // Check if total times match - if not, update to match the calculated value
            if (recipeData.total_time !== calculatedTotalTime) {
                console.log(`Updating total_time from ${recipeData.total_time} to ${calculatedTotalTime} to match stage durations`);
                recipeData.total_time = calculatedTotalTime;
            }

            // Remove any total_time_minutes property if it exists
            if ('total_time_minutes' in recipeData) {
                delete recipeData.total_time_minutes;
            }

            // Ensure Step property is a string
            recipeData.stages = recipeData.stages.map((stage, index) => ({
                ...stage,
                Step: typeof stage.Step === 'number' ? String(stage.Step) : stage.Step || String(index + 1)
            }));

            // Save the recipe to the database
            const newRecipe = new Recipe({
                userId: userId || null, // Add userId if available
                recipe_name: recipeData.recipe_name,
                total_time: recipeData.total_time,
                stages: recipeData.stages,
                nutrition: recipeData.nutrition,
                ingredients: recipeData.ingredients || ingredients,
                cuisine: cuisine,
            });

            await newRecipe.save(); // Save to MongoDB

            // Return the saved recipe
            res.json(newRecipe);
        } catch (parseError) {
            console.error("JSON parsing error:", parseError);
            console.error("Raw content that failed to parse:", content);
            
            // Create a simplified fallback response
            const fallbackRecipe = {
                recipe_name: `${cuisine} ${ingredients.join(' and ')} Recipe`,
                total_time: cookingTime || 5,
                stages: [
                    {
                        Step: "1",
                        Title: "Preparation 🧑‍🍳",
                        description: `Prepare the ingredients: ${ingredients.join(', ')}`,
                        duration: 1
                    },
                    {
                        Step: "2",
                        Title: "Cooking 🍳",
                        description: "Cook the ingredients according to recipe instructions.",
                        duration: 3
                    },
                    {
                        Step: "3",
                        Title: "Serving 🍽️",
                        description: "Serve and enjoy your meal!",
                        duration: 1
                    }
                ],
                nutrition: { calories: calories || 350, protein: 15, carbs: 40, fat: 12 },
                ingredients: ingredients.map(ing => `${ing} (${Math.round(calories/ingredients.length)} calories)`),
                cuisine: cuisine,
            };
            
            // Try to save the fallback recipe
            try {
                const newRecipe = new Recipe({
                    userId: userId || null,
                    ...fallbackRecipe
                });
                
                await newRecipe.save();
                res.json({
                    ...newRecipe.toObject(),
                    _note: "This is a fallback recipe due to parsing errors with the AI response."
                });
            } catch (dbError) {
                console.error("Database error with fallback recipe:", dbError);
                res.status(500).json({ 
                    error: "Failed to generate recipe",
                    requested_cooking_time: cookingTime || 5
                });
            }
        }
    } catch (error) {
        console.error(error);
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

const recipeHistoryDetails = async(req,res)=>{
    const {recipeId} = req.body
    try {
        const recipe = await Recipe.findOne({_id:recipeId})
        if(!recipe){
            return res.status(404).json({
                status:false,
                message :'Recipe not found'
            })
        }
        return res.status(200).json({
            status:false,
            recipe
        })
    } catch (error) {
        return res.status(500).json({
            status:false,
            message:'Internal server error',
            error:error.message
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

module.exports = { chat ,recipeHistory ,recipeHistoryDetails ,recordRecipeConsumption };
