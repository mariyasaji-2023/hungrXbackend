const { MongoClient } = require("mongodb")
const { ObjectId } = require("mongodb")
const client = new MongoClient(process.env.DB_URI)
const mongoose = require("mongoose")

// const get = async(req, res) => {
//     try {
//         await client.connect();
//         const db = client.db();
//         const commonfood = db.collection("commonfoods");
        
//         const categories = await commonfood.aggregate([
//             { $unwind: "$category.sub" },
//             { 
//                 $group: {
//                     _id: "$category.sub"
//                 }
//             },
//             { $sort: { _id: 1 } },
//             {
//                 $project: {
//                     _id: 0,
//                     name: "$_id"
//                 }
//             }
//         ]).toArray();

//         if (!categories || categories.length === 0) {
//             return res.status(400).json({
//                 status: false,
//                 message: "Categories not found"
//             });
//         }

//         // Extract just the names into an array
//         const subcategoryNames = categories.map(cat => cat.name);

//         return res.status(200).json({
//             status: true,
//             subcategories: subcategoryNames
//         });
//     } catch (error) {
//         return res.status(400).json({
//             status: false,
//             message: 'internal server error',
//             error: error.message
//         });
//     } finally {
//         await client.close();
//     }
// }

const searchCommonfood = async(req, res) => {
    const { name } = req.body;
    try {
        if(!name || name.trim().length === 0) {
            return res.status(400).json({
                status: false,
                message: 'Search term is required'
            });
        }

        const searchTerm = name.trim().toLowerCase();
        const commonfood = mongoose.connection.db.collection('commonfoods');
        
        // Split search term into individual words
        const searchWords = searchTerm.split(/\s+/);
        
        // Create an array of regex patterns for each word
        const wordPatterns = searchWords.map(word => new RegExp(word, "i"));
        
        // Construct a more flexible query that matches individual words
        const query = {
            $or: [
                // Match name containing any of the search words
                { name: { $in: wordPatterns } },
                // Match main category containing any of the search words
                { "category.main": { $in: wordPatterns } },
                // Match sub categories containing any of the search words
                { "category.sub": { $elemMatch: { $in: wordPatterns } } }
            ]
        };

        // Add exact phrase matching as an additional condition
        const exactPhraseQuery = {
            $or: [
                { name: { $regex: new RegExp(searchTerm, "i") } },
                { "category.main": { $regex: new RegExp(searchTerm, "i") } },
                { "category.sub": { $regex: new RegExp(searchTerm, "i") } }
            ]
        };

        // Combine both queries
        const finalQuery = {
            $or: [query, exactPhraseQuery]
        };

        const results = await commonfood.aggregate([
            { $match: finalQuery },
            // Add scoring to prioritize more relevant matches
            {
                $addFields: {
                    score: {
                        $add: [
                            // Exact name match gets highest score
                            { $cond: [{ $regexMatch: { input: "$name", regex: new RegExp(`^${searchTerm}$`, "i") } }, 10, 0] },
                            // Partial name match gets medium score
                            { $cond: [{ $regexMatch: { input: "$name", regex: new RegExp(searchTerm, "i") } }, 5, 0] },
                            // Category matches get lower scores
                            { $cond: [{ $regexMatch: { input: "$category.main", regex: new RegExp(searchTerm, "i") } }, 3, 0] },
                            { $cond: [{ $in: [true, { $map: { input: "$category.sub", as: "sub", in: { $regexMatch: { input: "$$sub", regex: new RegExp(searchTerm, "i") } } } }] }, 2, 0] }
                        ]
                    }
                }
            },
            { $sort: { score: -1 } },
            { $limit: 15 },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    "category.main": 1,
                    "category.sub": 1,
                    servingInfo: 1,
                    nutritionFacts: 1,
                    image: 1,
                    score: 1  // Include score in output for debugging
                }
            }
        ]).toArray();

        if (!results || results.length === 0) {
            return res.status(400).json({
                status: false,
                message: 'No matching results found'
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

module.exports = { searchCommonfood }