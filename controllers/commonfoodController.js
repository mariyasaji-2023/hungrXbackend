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

const searchCommonfood = async(req,res)=>{
    const {name} = req.body
    try {
        if(!name || !name.trim().length === 0){
            return res.status(400).json({
                status:false,
                message:'Search term is required'
            })
        }
        const searchTerm = name.trim().toLowerCase()
        const commonfood = mongoose.connection.db.collection('commonfoods')

        const searchWords = searchTerm.split(/\s+/)

        const query = {
            $or :[
                {name:{ $regex :new RegExp(searchTerm,"i")}},
                {"category.main":{$regex:new RegExp(searchTerm,"i")}},
                {"category.sub":{$regex:new RegExp(searchTerm,"i")}}
            ]
        }
        const results = await commonfood.aggregate([
            {$match :query},
            {$limit :15},
            {
                $project:{
                    _id:1,
                    name:1,
                    "category.main" :1,
                    "category.sub":1,
                    servingInfo:1,
                    nutritionFacts:1,
                    image:1
                }
            }
        ]).toArray();
        if (!results || results.length === 0){
            return res.status(400).json({
                status:false,
                message:'No matching results found'
            })
        }
        return res.status(200).json({
            status:true,
            count:results.length,
            data:results
        })
    } catch (error) {
        console.error("Error during search:", error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
            error: error.message
        });
    }
}
module.exports = { searchCommonfood }