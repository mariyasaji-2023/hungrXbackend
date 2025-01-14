const User = require('../models/userModel')

const addWaterIntake = async (req, res) => {
    const { userId, amountInMl } = req.body
    try {
        const user = await User.findById(userId)
        if (!user) {
            return res.status(400).json({
                status: false,
                message: 'User not found'
            })
        }

        // Convert amount to number
        const amount = parseInt(amountInMl, 10);

        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                status: false,
                message: 'Invalid water amount'
            });
        }

        const today = new Date().toLocaleDateString('en-GB');
        const dailyGoalInMl = parseFloat(user.dailyWaterIntake) * 1000;

        let todayData = user.waterIntakeHistory.get(today) || {
            totalIntake: 0,
            entries: [],
            remaining: dailyGoalInMl
        };

        // Ensure totalIntake is a number
        const currentTotal = parseInt(todayData.totalIntake, 10) || 0;

        todayData.entries.push({
            amount: amount,
            timestamp: new Date()
        });

        // Add numbers, not strings
        todayData.totalIntake = currentTotal + amount;
        todayData.remaining = Math.max(0, dailyGoalInMl - todayData.totalIntake);

        user.waterIntakeHistory.set(today, todayData);
        user.markModified('waterIntakeHistory');

        await user.save();

        return res.status(200).json({
            success: true,
            data: {
                date: today,
                totalIntake: todayData.totalIntake,
                remaining: todayData.remaining,
                dailyGoal: dailyGoalInMl,
                entries: todayData.entries,
                percentage: ((todayData.totalIntake / dailyGoalInMl) * 100).toFixed(1)
            }
        });
    } catch (error) {
        console.error('Error adding water intake', error)
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        })
    }
}

const getWaterIntakeData = async (req, res) => {
    try {
        const { userId, date } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get data from Map using get() method
        const dateIntake = user.waterIntakeHistory.get(date) || {
            totalIntake: 0,
            entries: [],
            remaining: Math.round(user.dailyWaterIntake * 1000)
        };

        // Calculate remaining water
        const remaining = dateIntake.totalIntake ? 
            Math.round(user.dailyWaterIntake * 1000) - dateIntake.totalIntake : 
            Math.round(user.dailyWaterIntake * 1000);

        res.status(200).json({
            success: true,
            data: {
                dailyWaterIntake: user.dailyWaterIntake,
                dateStats: {
                    date: date,
                    totalIntake: dateIntake.totalIntake || 0,
                    remaining: remaining,
                    entries: dateIntake.entries || [],
                    // targetAchievedPercentage: ((dateIntake.totalIntake || 0) / (user.dailyWaterIntake * 1000) * 100).toFixed(1)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching water intake data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};


module.exports = { addWaterIntake, getWaterIntakeData }