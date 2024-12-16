const mongoose = require('mongoose')

const userActivitySchema = new mongoose.Schema({
    userId: {
        type: String
    },
    date: {
        type: Date
    }
})

const UserActivity = mongoose.model('UserActivity', userActivitySchema);

module.exports = UserActivity;