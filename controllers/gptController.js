const { OpenAI } = require("openai");
const Recipe = require("../models/recipeModel"); // Import the Recipe model
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const chat = async (req, res) => {
    try {
        const { ingredients, cuisine, calories, cookingTime, userId } = req.body;

        // Format the prompt
        let prompt = `Generate a ${cuisine} recipe using only ${ingredients.join(', ')}. 
        Total cooking time must be exactly ${cookingTime || '5'} minutes. If the recipe cannot fit within this time, adjust the steps or ingredients accordingly. Format as timed stages:
        Step: [step number] - Title: [step_name with emoji] - [description] - [duration]
        Step: [step number] - Title: [step_name with emoji] - [description] - [duration]
        [continue for all stages]
        Nutritional info (per serving):
        - Calories: ${calories || '[value]'}
        - Protein: [value]g
        - Carbs: [value]g
        - Fat: [value]g
        Return JSON format:
        {
          "recipe_name": "",
          "total_time": ${cookingTime || 5},
          "stages": [{"Step": "", "Title": "", "description": "", "duration": 0}],
          "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
        }`;
        

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });

        // Parse the response to extract the JSON
        const content = response.choices[0].message.content;
        try {
            // Extract JSON from the text
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : content;
            const recipeData = JSON.parse(jsonStr);

            // Always calculate total time from stages to ensure consistency
            const calculatedTotalTime = recipeData.stages.reduce(
                (total, stage) => total + (stage.duration || 0),
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

            // Save the recipe to the database
            const newRecipe = new Recipe({
                userId: userId || null, // Add userId if available
                recipe_name: recipeData.recipe_name,
                total_time: recipeData.total_time,
                stages: recipeData.stages,
                nutrition: recipeData.nutrition,
                ingredients: ingredients,
                cuisine: cuisine,
            });

            await newRecipe.save(); // Save to MongoDB

            // Return the saved recipe
            res.json(newRecipe);
        } catch (parseError) {
            console.error("JSON parsing error:", parseError);
            // Fallback to returning raw content if parsing fails
            res.json({
                reply: content,
                requested_cooking_time: cookingTime || 5
            });
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

module.exports = { chat ,recipeHistory ,recipeHistoryDetails };
