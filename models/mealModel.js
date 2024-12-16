const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    meal: {
        type: String,
        enum: ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
    }
})

module.exports = mongoose.model('Meal', userSchema)