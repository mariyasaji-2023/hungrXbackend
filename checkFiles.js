// const timezone = async (req, res) => {
//   try {
//     const { userId, timezone } = req.body;

//     // Validate Request
//     if (!userId || !timezone) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: userId and timezone are required"
//       });
//     }

//     // Validate timezone format
//     // You can use a library like moment-timezone for more robust validation
//     const validTimezones = [
//       "America/New_York",     // Eastern Time
//       "America/Chicago",      // Central Time
//       "America/Denver",       // Mountain Time
//       "America/Los_Angeles",  // Pacific Time
//       "America/Anchorage",    // Alaska Time
//       "Pacific/Honolulu",     // Hawaii Time
//       "America/Phoenix",      // Arizona Time (no DST)
//       "America/Puerto_Rico",  // Atlantic Time
//       "Pacific/Guam"         // Guam Time
//     ];
    
//     if (!validTimezones.includes(timezone)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid timezone format"
//       });
//     }

//     // Validate userId format
//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid userId format"
//       });
//     }

//     // Check if user exists
//     const user = await User.findById(userId);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found"
//       });
//     }

//     // Update user timezone
//     user.timezone = timezone;
//     await user.save();

//     return res.status(200).json({
//       success: true,
//       message: "Timezone updated successfully",
//       data: {
//         userId: user._id,
//         timezone: user.timezone,
//         updatedAt: user.updatedAt
//       }
//     });

//   } catch (error) {
//     console.error('Timezone update error:', error);
    
//     // Handle specific errors
//     if (error.name === 'ValidationError') {
//       return res.status(400).json({
//         success: false,
//         message: "Validation error",
//         error: error.message
//       });
//     }

//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };






const timezone = async (req,res)=>{
  try {
    const {userId, timezone} = req.body;
    if(!userId || !timezone){
      return res.status(400).json({
        status:false,
        message:''
      })
    }
  } catch (error) {
    
  }
}