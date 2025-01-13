const mongoose = require('mongoose')
const reqRestaurantSchema = new mongoose.Schema({
    userId :{
       type:String,
       required :true 
    },
    restaurantName:{
        type:String,
        required:true
    },
    restaurantType:{
        type:String,
        require:true
    },
    area:{
        type:String,
        required:true
    }
})

module.exports = mongoose.model('reqRestaurants',reqRestaurantSchema)