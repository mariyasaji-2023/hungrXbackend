const WaterTracker = require('../models/waterModel')
const User = require('../models/userModel')

const initializeWaterTracking = async (req, res) => {
    const { userId } = req.body
    try {
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            })
        }

        const { weightInKg, weightInLbs, isMetric, activityLevel, TDEE } = user
        const weightInKilos = isMetric ? weightInKg : weightInLbs * 0.453592
        const baseWater = weightInKilos * 0.033;
        const activityMultiplier = {
            'sedentary': 1.0,
            'lightly active': 1.1,
            'moderately active': 1.2,
            'very active': 1.3,
            'extra active': 1.4
        }[activityLevel] || 1.0;

        const tdeeAdjustment = (TDEE / 500) * 0.35;
        const totalWaterNeeded = baseWater * activityMultiplier + tdeeAdjustment;
        const targetWaterIntake = Math.round(totalWaterNeeded * 100) / 100

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Find or create today's water tracking record
        let waterTracker = await WaterTracker.findOne({
            userId,
            date: {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            }
        });

        if (!waterTracker) {
            waterTracker = new WaterTracker({
                userId,
                targetWaterIntake,
                waterConsumed: 0,
                waterLog: []
            });
            await waterTracker.save();
        }
        return res.status(200).json({
            status: true,
            data: {
                targetWaterIntake,
                waterConsumed: waterTracker.waterConsumed,
                remainingWater: Math.max(0, targetWaterIntake - waterTracker.waterConsumed),
                progress: Math.min(100, (waterTracker.waterConsumed / targetWaterIntake) * 100),
                lastUpdate: waterTracker.waterLog[waterTracker.waterLog.length - 1]?.timestamp
            }
        })
    } catch (error) {
        console.log('Error innitializing water tracking:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        })

    }
}


module.exports = { initializeWaterTracking }