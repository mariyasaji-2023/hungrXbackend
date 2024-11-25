const User = require("../models/userModel")

const getEatPage = async(req,res)=>{
    const {userId} = req.body
    try {
        const user = await User.findOne({_id:userId})
        if(!user){
            return res.staus(404).json({
                status:false,
                data:{
                    error:'User not found'
                }
            })
        }
        const {name,dailyCalorieGoal}= user

        console.log(name,dailyCalorieGoal);
        
        if(!name || !dailyCalorieGoal ){
            return res.status(400).json({
                status:false,
                data:{
                    message: 'Missing essential user details'
                }
            })
        }

        return res.status(200).json({
            status:true,
            data:{
                username:name,
                dailyCalorieGoal
            }
        })
    } catch (error) {
        console.error('Error fetching user details:', error);
        return res.status(500).json({
            status: false,
            data: {
                message: 'Server error'
            }
        });
    }
}
module.exports={getEatPage}