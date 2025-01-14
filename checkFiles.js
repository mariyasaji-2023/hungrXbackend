const addWaterIntake = async (userId, amountInMl) => {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
  
      const today = new Date().toLocaleDateString('en-GB'); // Format: DD/MM/YYYY
      const dailyGoalInMl = parseFloat(user.dailyWaterIntake) * 1000; // Convert L to ml
  
      // Get or initialize today's water intake data
      let todayData = user.waterIntakeHistory.get(today) || {
        totalIntake: 0,
        entries: [],
        remaining: dailyGoalInMl
      };
  
      // Add new entry
      todayData.entries.push({
        amount: amountInMl,
        timestamp: new Date()
      });
  
      // Update totals
      todayData.totalIntake += amountInMl;
      todayData.remaining = Math.max(0, dailyGoalInMl - todayData.totalIntake);
  
      // Update the history
      user.waterIntakeHistory.set(today, todayData);
  
      await user.save();
  
      return {
        success: true,
        data: {
          date: today,
          totalIntake: todayData.totalIntake,
          remaining: todayData.remaining,
          dailyGoal: dailyGoalInMl,
          entries: todayData.entries
        }
      };
    } catch (error) {
      console.error('Error adding water intake:', error);
      throw error;
    }
  };