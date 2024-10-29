const bcrypt = require('bcrypt');
const User = require('../models/userModel'); // Assuming you have a User model
const UserActivity = require('../models/trackUserModel')
const Weight = require('../models/userWeightModel')
const Feedback = require('../models/feedbackModel')
require('dotenv').config()

const submitFeedback = async (req, res) => {
    const { userId, stars, description } = req.body
    try {
        const feedback = new Feedback({ userId, stars, description });
        await feedback.save();

        res.status(201).json({
            status: true,
            data: {
                message: 'Feedback submitted successfully',
                feedback
            }
        })
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
}

module.exports = {submitFeedback}