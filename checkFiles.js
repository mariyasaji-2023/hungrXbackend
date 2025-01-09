const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
const mongoose = require("mongoose"); // Ensure this is included if using mongoose

const searchCommonfood = async (req, res) => {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
        return res.status(400).json({
            status: false,
            message: "Search term is required"
        });
    }

    const searchTerm = name.trim().toLowerCase();

    try {
        // Get the "commonfoods" collection
        const commonfood = mongoose.connection.db.collection("commonfoods");

        // Split the search term into words for partial matching
        const searchWords = searchTerm.split(/\s+/);

        // Build the $or query to match against 'name', 'main', and 'sub' fields
        const query = {
            $or: [
                { name: { $regex: new RegExp(searchTerm, "i") } }, // Match `name` field
                { "category.main": { $regex: new RegExp(searchTerm, "i") } }, // Match `main` in `category`
                { "category.sub": { $elemMatch: { $regex: new RegExp(searchTerm, "i") } } } // Match any `sub` in `category`
            ]
        };

        // Use MongoDB aggregation to fetch results with relevance scoring
        const results = await commonfood.aggregate([
            { $match: query }, // Apply the search query
            { $limit: 15 }, // Limit the results
            {
                $project: {
                    _id: 1,
                    name: 1,
                    "category.main": 1,
                    "category.sub": 1,
                    servingInfo: 1,
                    nutritionFacts: 1,
                    image: 1
                }
            }
        ]).toArray();

        if (!results || results.length === 0) {
            return res.status(404).json({
                status: false,
                message: "No matching results found"
            });
        }

        return res.status(200).json({
            status: true,
            count: results.length,
            data: results
        });

    } catch (error) {
        console.error("Error during search:", error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
            error: error.message
        });
    }
};
