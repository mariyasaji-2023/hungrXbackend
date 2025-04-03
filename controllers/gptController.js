const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const chat = async(req, res) => {
    try {
        const { ingredients, cuisine, calories } = req.body;
        
        // Format the prompt
        let prompt = `Generate a ${cuisine} recipe using only ${ingredients.join(', ')}. Total cooking time: 5 minutes. Format as timed stages:
Stage 1: [action] - [time]
Stage 2: [action] - [time]
[continue for all stages]
Nutritional info (per serving):
- Calories: ${calories || '[value]'}
- Protein: [value]g
- Carbs: [value]g
- Fat: [value]g
Return JSON format:
{
  "recipe_name": "",
  "stages": [{"action": "", "time_seconds": 0}],
  "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
}`;
    
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
        });
    
        // Parse the response to extract the JSON
        const content = response.choices[0].message.content;
        try {
            // Extract JSON from the text (handles if there's text before/after JSON)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : content;
            const recipeData = JSON.parse(jsonStr);
            
            // Return the parsed JSON directly
            res.json(recipeData);
        } catch (parseError) {
            // Fallback to returning the raw content if parsing fails
            res.json({ reply: content });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong!" });
    }
};

module.exports = {chat}