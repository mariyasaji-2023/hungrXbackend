const updateBasicInfo = async (req, res) => {
    const { 
        userId,
        name,
        gender,
        mobile,
        email,
        age,
        weightInKg,
        weightInLbs,
        targetWeight,
        heightInCm,
        goal
    } = req.body;

    try {
        // Find user first
        const user = await userModel.findOne({ _id: userId });
        
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User does not exist',
            });
        }

        // Validate email format if provided
        if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid email format',
            });
        }

        // Validate age if provided
        if (age && (age < 13 || age > 100)) {
            return res.status(400).json({
                status: false,
                message: 'Age must be between 13 and 100',
            });
        }

        // Validate height if provided
        if (heightInCm && (heightInCm < 100 || heightInCm > 250)) {
            return res.status(400).json({
                status: false,
                message: 'Height must be between 100cm and 250cm',
            });
        }

        // Handle weight based on metric preference
        let updatedWeight = {};
        if (user.isMetric && weightInKg) {
            if (weightInKg < 30 || weightInKg > 300) {
                return res.status(400).json({
                    status: false,
                    message: 'Weight must be between 30kg and 300kg',
                });
            }
            updatedWeight.weightInKg = weightInKg;
        } else if (!user.isMetric && weightInLbs) {
            if (weightInLbs < 66 || weightInLbs > 660) {
                return res.status(400).json({
                    status: false,
                    message: 'Weight must be between 66lbs and 660lbs',
                });
            }
            updatedWeight.weightInLbs = weightInLbs;
        }

        // Validate target weight if provided
        if (targetWeight && (targetWeight < 30 || targetWeight > 300)) {
            return res.status(400).json({
                status: false,
                message: 'Target weight must be between 30kg and 300kg',
            });
        }

        // Create update object with only provided fields
        const updateData = {
            ...(name && { name }),
            ...(gender && { gender }),
            ...(mobile && { mobile }),
            ...(email && { email }),
            ...(age && { age }),
            ...updatedWeight,
            ...(targetWeight && { targetWeight }),
            ...(heightInCm && { heightInCm }),
            ...(goal && { goal }),
        };

        // Update user
        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true }  // Return updated document
        );

        return res.status(200).json({
            status: true,
            message: 'User details updated successfully',
            data: updatedUser,
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};