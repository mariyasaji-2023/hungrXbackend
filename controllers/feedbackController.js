const bcrypt = require('bcrypt');
const User = require('../models/userModel')
const UserActivity = require('../models/trackUserModel')
const Weight = require('../models/userWeightModel')
const Feedback = require('../models/feedbackModel')
const bugModel = require('../models/bugModel')
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

const reportBug = async (req, res) => {
    const { userId, report } = req.body
    try {
        const message = new bugModel({ userId, report })
        await message.save()
        res.status(201).json({
            status: true,
            data: {
                message: "submitted successfully",
                message
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


module.exports = { submitFeedback, reportBug }