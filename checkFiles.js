const { default: mongoose } = require("mongoose")

const getUserHistory = async(req,res)=>{
    const {userId} = req.body
    try {
        if(!userId){
            return res.status(400).json({
                status : false,
                data:{
                    message:'User ID is required'
                }
            })
        }
        const history = mongoose.connection.db.collection("history")


    } catch (error) {
        
    }
}