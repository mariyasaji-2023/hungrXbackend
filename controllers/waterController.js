const User = require('../models/userModel')


const addWaterIntake = async (req, res) => {
    const { userId, amountInMl } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({
                status: false,
                message: 'User not found'
            });
        }

        // Convert amount to number
        const amount = parseInt(amountInMl, 10);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                status: false,
                message: 'Invalid water amount'
            });
        }

        // Get user's timezone or default to 'America/New_York'
        const userTimezone = user.timezone || 'America/New_York';

        // Create timestamp and format date in user's timezone
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: userTimezone,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        // Get the date in DD/MM/YYYY format
        const date = formatter.format(now);

        // Create UTC timestamp for storage
        const timestamp = now.toISOString();

        const dailyGoalInMl = parseFloat(user.dailyWaterIntake) * 1000;

        let todayData = user.waterIntakeHistory.get(date) || {
            totalIntake: 0,
            entries: [],
            remaining: dailyGoalInMl
        };

        // Ensure totalIntake is a number
        const currentTotal = parseInt(todayData.totalIntake, 10) || 0;

        // Add new entry with UTC timestamp
        todayData.entries.push({
            amount: amount,
            timestamp: timestamp
        });

        // Add numbers, not strings
        todayData.totalIntake = currentTotal + amount;
        todayData.remaining = Math.max(0, dailyGoalInMl - todayData.totalIntake);

        user.waterIntakeHistory.set(date, todayData);
        user.markModified('waterIntakeHistory');

        await user.save();

        return res.status(200).json({
            success: true,
            data: {
                date: date,
                totalIntake: todayData.totalIntake,
                remaining: todayData.remaining,
                dailyGoal: dailyGoalInMl,
                entries: todayData.entries,
                percentage: ((todayData.totalIntake / dailyGoalInMl) * 100).toFixed(1)
            }
        });

    } catch (error) {
        console.error('Error adding water intake', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
};

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

const removeWaterEntry = async (req, res) => {
    try {
        const { userId, date, entryId } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get the date's water intake data using Map.get()
        const dateIntake = user.waterIntakeHistory.get(date);
        
        if (!dateIntake) {
            return res.status(404).json({
                success: false,
                message: 'No water intake records found for this date'
            });
        }

        // Find the entry to remove
        const entryIndex = dateIntake.entries.findIndex(
            entry => entry._id.toString() === entryId
        );

        if (entryIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Entry not found'
            });
        }

        // Get the amount of water to subtract
        const amountToSubtract = dateIntake.entries[entryIndex].amount;

        // Remove the entry and update totals
        dateIntake.entries.splice(entryIndex, 1);
        dateIntake.totalIntake -= amountToSubtract;
        dateIntake.remaining = Math.round(user.dailyWaterIntake * 1000) - dateIntake.totalIntake;

        // If no entries left, delete the date entry using Map.delete()
        if (dateIntake.entries.length === 0) {
            user.waterIntakeHistory.delete(date);
        } else {
            // Update the existing entry in the Map
            user.waterIntakeHistory.set(date, dateIntake);
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Water intake entry removed successfully',
            data: {
                date,
                remainingEntries: dateIntake.entries.length,
                updatedTotalIntake: dateIntake.totalIntake,
                updatedRemaining: dateIntake.remaining
            }
        });

    } catch (error) {
        console.error('Error removing water intake entry:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};


module.exports = { addWaterIntake, getWaterIntakeData ,removeWaterEntry}