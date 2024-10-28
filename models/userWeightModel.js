const mongoose = require ('mongoose')

const weightSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true
    },
    weight: { 
        type: Number, 
        required: true 
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
})

const Weight = mongoose.model('Weight', weightSchema);
module.exports = Weight;