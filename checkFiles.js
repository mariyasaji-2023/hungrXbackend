const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/User'); // Assuming User model is in models/User.js

const app = express();
app.use(express.json());

// API to verify expiration date
app.post('/verify-expiry', async (req, res) => {
   try {
    const {userId ,currentDate} = req.body
    if(!userId || !currentDate){
      return res.status(400).json({
        status:false,
        message:'User ID and current date are required'
      })
    }
    const user =await User.findById(userId)
    if(!user){
      return res.status(404).json({
        status:false,
        message:'User not found'
      })
    }
    if(!user.expirationDate){
      return res.status(400).json({
        status:false,
        message:'Expiration date not set for user'
      })
    }
    const expiryDate = new Date(user.expirationDate);
    const inputDate = new Date (currentDate)

    if(isNaN(expiryDate) || isNaN(inputDate)){
      return res.status(400).json({
        status:false,
        message:'invalid date format'
      })
    }
    const isExpired = inputDate > expiryDate;
    // return res
   } catch (error) {
    
   }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
