const userModel = require('../models/userModel')

const getEatPage = async(req,res)=>{
    const {userId} = req.body
    try {
        const user = await userModel.findOne({_id:userId})
        if(!user){
            return res.status(404).json({
                status:false,
                message:'user is not exist'
            })
        }
        const {name,dailyCalorieGoal,profilePhoto} = user
        if(!name || !dailyCalorieGoal || !profilePhoto){
            return res.status(404).json({
                status:false,
                message:'missing essantial user details'
            })
        }
        return res.status(200).json({
            status:true,
            data:{
                name,
                dailyCalorieGoal,
                profilePhoto
            }
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status:false,
            message:error
        })
    }
}

module.exports = {getEatPage}