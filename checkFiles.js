const User = require('./models/userModel')
const mongoose =  require('mongoose')
const mealModel = require('./models/mealModel')

const timeZone = async(req,res)=>{
  const {userId,timeZone}= req.body;
  try {
    if(!userId || !timeZone) {
      return res.status(404).json({
        status:false,
        message:'missing required fields'
      })
    }
    const validTimezones = [
      "America/New_York",     // Eastern Time
      "America/Chicago",      // Central Time
      "America/Denver",       // Mountain Time
      "America/Los_Angeles",  // Pacific Time
      "America/Anchorage",    // Alaska Time
      "Pacific/Honolulu",     // Hawaii Time
      "America/Phoenix",      // Arizona Time (no DST)
      "America/Puerto_Rico",  // Atlantic Time
      "Pacific/Guam" ,        // Guam Time
      "Asia/Kolkata"          // Indian Standard Time (IST)
    ];

    if(!validTimezones.includes(timeZone)){
      return res.status(400).json({
        status:false,
        message:'invalid time zone'
      })
    }
    const user = await User.findById(userId)
    if(!user){
      return res.status(400).json({
        status:false,
        message:'user not found'
      })
    }

    user.timezone = timezone
    await user.save()

    res.status(200).json({
      status:true,
      message:'Timezon updated successfully',
      data:{
        userId:user.id,
        timezone:user.timezone,
        updatedAt:user.updatedAt
      }
    })
  } catch (error) {
    console.log('timezone update error:',error);
    return res.status(500).json({
      status:false,
      error:'internal server error'
    })
  }
}


const getMeal = async(req,res)=>{
  try {
    const meals = await mealModel.find({})
    res.status(200).json({
      status:true,
      message:'Meals fetched succesfully',
      data:meals
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      status:false,
      message:'failed to fetch meals'
    })
  }
}

module.exports={timeZone,getMeal}