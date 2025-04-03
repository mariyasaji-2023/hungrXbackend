const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const chat = async (req, res) => {
    try {
        const { ingredients, cuisine, calories, cookingTime } = req.body;

        // Format the prompt
        let prompt = `Generate a ${cuisine} recipe using only ${ingredients.join(', ')}. Total cooking time: ${cookingTime || '5'} minutes. Format as timed stages:
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

            // Return the parsed JSON directly
            res.json(recipeData);
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

module.exports = { chat };