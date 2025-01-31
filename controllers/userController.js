
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/userModel');
const UserActivity = require('../models/trackUserModel');
const Weight = require('../models/userWeightModel');
require('dotenv').config();
const twilio = require('twilio');

const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const verifyToken = (req, res, next) => {

    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token.' });
    }
};


const signupWithEmail = async (req, res) => {
    const { email, password, reenterPassword } = req.body;

    if (password !== reenterPassword) {
        return res.status(400).json({
            data: {
                message: 'Passwords do not match'
            }
        });
    }

    try {

        let user = await User.findOne({ email });

        if (user && user.isVerified) {
            return res.status(400).json({
                data: {
                    message: 'Email already exists'
                }
            });
        }


        const hashedPassword = await hashPassword(password);

        if (!user) {
            user = new User({
                email,
                password: hashedPassword,
                isVerified: false,
            });
        } else {

            user.password = hashedPassword;
            user.isVerified = false;
        }

        await user.save();

        const token = generateToken(user._id);

        return res.status(201).json({
            data: {
                message: 'Registration successful.',
                token: token,
                userId: user._id,
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
        console.log(err);

    }
};

const loginWithEmail = async (req, res) => {
    const { email, password } = req.body;

    try {

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                data: {
                    message: 'User not found'
                }
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                data: {
                    message: 'Invalid password'
                }
            });
        }

        const token = generateToken(user._id);

        return res.status(200).json({
            data: {
                message: 'Login successful.',
                token: token,
                userId: user._id,
            },
        });
    } catch (err) {
        res.status(500).json({
            data: {
                message: err.message
            }
        });
    }
};


const accountSid = process.env.TWILIO_ACCOUNT_SID;  // Twilio Account SID
const authToken = process.env.TWILIO_AUTH_TOKEN;    // Twilio Auth Token
const serviceSid = process.env.TWILIO_SERVICE_SID;  // Twilio Verify Service SID

const client = twilio(accountSid, authToken);



const sendOTP = async (req, res) => {
    const { mobile } = req.body;

    if (!accountSid || !authToken || !serviceSid) {
        console.error("Twilio credentials are missing. Ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SERVICE_SID are set.");
        return res.status(500).json({
            status: false,
            data: {
                message: "Server configuration error"
            }
        });
    }

    if (!mobile) {
        return res.status(400).json({
            status: false,
            data: {
                message: "Mobile number is required"
            }
        });
    }

    try {
        const verification = await client.verify.v2
            .services(serviceSid)
            .verifications.create({
                to: `+${mobile}`,
                channel: 'sms'
            });

        return res.status(200).json({
            status: true,
            data: {
                message: 'OTP sent',
                verificationSid: verification.sid
            }
        });

    } catch (error) {
        console.error('Twilio API Error:', error);
        return res.status(500).json({
            status: false,
            data: {
                message: error.message
            }
        });
    }
};

const verifyOTP = async (req, res) => {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
        return res.status(400).json({
            status: false,
            data: {
                message: "Mobile number and OTP are required"
            }
        });
    }

    try {
        console.log('Service SID:', serviceSid);
        console.log('Mobile:', mobile);
        console.log('OTP:', otp);
        const verification_check = await client.verify.v2.services(serviceSid)
            .verificationChecks.create({ to: `+${mobile}`, code: otp });

        if (verification_check.status === 'approved') {
            // Check if the user already exists
            let user = await User.findOne({ mobile });

            if (!user) {
                // Create a new user
                user = new User({
                    mobile,
                    isVerified: true // Mark as verified since OTP is confirmed
                });
                await user.save();

            } else {

                user.isVerified = true;
                await user.save();
            }

            res.status(200).json({
                status: true,
                data: {
                    message: 'OTP verified successfully. User has been created/updated.',
                    userId: user._id,
                    mobile: user.mobile,
                    isVerified: user.isVerified,
                    isMetric: user.isMetric,
                }
            });
        } else {
            res.status(400).json({
                status: false,
                data: {
                    message: 'Invalid OTP'
                }
            });
        }
    } catch (error) {
        res.status(500).json({
            status: false,
            data: {
                message: error.message
            }
        });
    }
};


const loginWithGoogle = async (req, res) => {
    const { googleId, email, name } = req.body;

    try {
        let user = await User.findOne({ googleId });

        let message;
        if (!user) {
            // New user, sign them up
            user = new User({ googleId, email, name });
            await user.save();
            message = 'Signup successful';
        } else {
            // Existing user, log them in
            message = 'Login successful';
        }

        // Generate JWT token
        const jwtToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
            expiresIn: '1h',
        });

        // Send response
        res.status(200).json({
            status: true,
            data: {
                message,
                token: jwtToken,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                },
            }
        });
    } catch (error) {
        console.error('Error in Google login/signup:', error);
        res.status(500).json({
            status: false,
            data: {
                message: 'Internal server error'
            }
        });
    }
};

const createProfile = async (req, res) => {
    const {
        userId,
        name,
        gender,
        heightInFeet,
        heightInInches,
        heightInCm,
        isMetric,
        weightInKg,
        weightInLbs,
        mealsPerDay,
        goal,
        targetWeight,
        weightGainRate,
        activityLevel,
        age,
        profilePhoto
    } = req.body;

    try {
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({
                status: false,
                message: {
                    data: 'User not found'
                }
            });
        }

        const updateUserDetails = async (user) => {
            if (name) user.name = name;
            if (gender) user.gender = gender;
            if (profilePhoto) user.profilePhoto = profilePhoto;
            if (isMetric) {
                user.heightInCm = heightInCm;
            } else {
                user.heightInFeet = heightInFeet;
                user.heightInInches = heightInInches;
            }

            user.isMetric = isMetric;

            if (weightInKg) {
                user.weightInKg = weightInKg;
            } else if (weightInLbs) {
                user.weightInLbs = weightInLbs;
            }

            if (age) user.age = age;
            if (mealsPerDay) user.mealsPerDay = mealsPerDay;
            if (goal) user.goal = goal;
            if (goal && targetWeight) user.targetWeight = targetWeight;
            if (weightGainRate) user.weightGainRate = weightGainRate;
            if (activityLevel) user.activityLevel = activityLevel;

            await user.save();

            // Store weight in Weight collection
            if (weightInKg || weightInLbs) {
                const weightToStore = weightInKg || (weightInLbs * 0.453592); // Convert lbs to kg if needed
                
                // Create or update weight record
                const weightRecord = await Weight.findOne({ userId });
                
                if (weightRecord) {
                    // Update existing record
                    weightRecord.weight = weightToStore;
                    weightRecord.weightHistory.push({
                        weight: weightToStore,
                        timestamp: new Date()
                    });
                    weightRecord.updatedAt = new Date();
                    await weightRecord.save();
                } else {
                    // Create new record
                    const newWeightRecord = new Weight({
                        userId,
                        weight: weightToStore,
                        weightHistory: [{
                            weight: weightToStore,
                            timestamp: new Date()
                        }]
                    });
                    await newWeightRecord.save();
                }
            }
        };

        await updateUserDetails(user);

        res.status(200).json({
            status: true,
            data: {
                message: 'User details have been updated successfully'
            },
        });
    } catch (error) {
        console.error('Error updating user details:', error);
        res.status(500).json({
            status: false,
            data: {
                message: 'Internal server error'
            }
        });
    }
};


const calculateUserMetrics = async (req, res) => {
    const { userId } = req.body;

    try {
        const user = await User.findById({ _id: userId });
        if (!user) {
            return res.status(404).json({
                status: false,
                data: {
                    message: 'User not found'
                }
            });
        }

        const {
            weightInKg,
            weightInLbs,
            heightInCm,
            heightInFeet = 0,
            heightInInches = 0,
            isMetric,
            gender,
            age,
            activityLevel,
            targetWeight,
            weightGainRate = 0.25,
            goal
        } = user;

        if (!age || !gender || (!weightInKg && !weightInLbs)) {
            return res.status(400).json({
                status: false,
                data: {
                    message: 'Missing required user data'
                }
            });
        }

        // Format current date as DD/MM/YYYY
        const formatDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        };

        let weight = isMetric ? weightInKg : weightInLbs * 0.453592;
        let height = isMetric
            ? heightInCm / 100
            : ((heightInFeet * 12) + heightInInches) * 0.0254;

        if (!weight || !height) {
            return res.status(400).json({
                status: false,
                data: {
                    message: 'Invalid height or weight'
                }
            });
        }

        // BMR Calculation
        const BMR = gender === 'male'
            ? 10 * weight + 6.25 * (height * 100) - 5 * age + 5
            : 10 * weight + 6.25 * (height * 100) - 5 * age - 161;

        // TDEE Calculation
        const activityMultiplier = {
            'sedentary': 1.2,
            'lightly active': 1.375,
            'moderately active': 1.55,
            'very active': 1.725,
            'extra active': 1.9,
        };
        const TDEE = BMR * (activityMultiplier[activityLevel] || 1.2);

        // Calculate daily water intake
        const calculateWaterIntake = () => {
            let baseWaterIntake = weight * 30;
            const activityWaterMultiplier = {
                'sedentary': 1.0,
                'lightly active': 1.1,
                'moderately active': 1.2,
                'very active': 1.3,
                'extra active': 1.4,
            };
            baseWaterIntake *= activityWaterMultiplier[activityLevel] || 1.0;
            if (age > 55) {
                baseWaterIntake *= 1.1;
            }
            return (baseWaterIntake / 1000).toFixed(2);
        };

        const waterIntake = calculateWaterIntake();
        const BMI = weight / (height ** 2);

        const weightChange = targetWeight
            ? (Number(targetWeight) * (isMetric ? 1 : 0.453592) - weight)
            : 0;

        // Calculate daily calories and adjustments
        const minCalories = gender === 'male' ? 1500 : 1200;

        // Set weekly rate based on goal
        let weeklyRate = 0; // Default to 0 for maintain
        if (goal === 'gain weight' || goal === 'lose weight') {
            weeklyRate = weightGainRate || 0.25; // Use provided rate or default to 0.25
        }

        const dailyCalorieAdjustment = (weeklyRate * 7700) / 7;

        // Set daily calorie goal based on goal direction
        let dailyCalorieGoal = TDEE;
        if (goal === 'gain weight') {
            dailyCalorieGoal += dailyCalorieAdjustment;
        } else if (goal === 'lose weight') {
            dailyCalorieGoal -= dailyCalorieAdjustment;
        }

        // Ensure minimum calories
        dailyCalorieGoal = Math.max(dailyCalorieGoal, minCalories);

        // Calculate goal-related metrics
        const caloriesToReachGoal = Math.abs(weightChange * 7700);
        const weeklyCaloricChange = weeklyRate * 7700;
        const daysToReachGoal = weightChange !== 0 && weeklyRate !== 0
            ? Math.ceil((caloriesToReachGoal / weeklyCaloricChange) * 7)
            : 0;

        // Update user metrics with calculation date
        user.BMI = BMI.toFixed(2);
        user.BMR = BMR.toFixed(2);
        user.TDEE = TDEE.toFixed(2);
        user.dailyCalorieGoal = dailyCalorieGoal.toFixed(2);
        user.caloriesToReachGoal = caloriesToReachGoal.toFixed(2);
        user.daysToReachGoal = daysToReachGoal;
        user.dailyWaterIntake = waterIntake;
        user.calculationDate = formatDate(new Date()); // Add calculation date

        await user.save();

        // Return consistent response format
        res.status(200).json({
            status: true,
            data: {
                calculationDate: formatDate(new Date()),
                goal,
                activityLevel,
                height: isMetric
                    ? `${(height * 100).toFixed(2)} cm`
                    : `${heightInFeet} ft ${heightInInches} in`,
                weight: isMetric ? `${weightInKg} kg` : `${weightInLbs} lbs`,
                BMI: BMI.toFixed(2),
                BMR: BMR.toFixed(2),
                TDEE: TDEE.toFixed(2),
                dailyCalorieGoal: dailyCalorieGoal.toFixed(2),
                caloriesToReachGoal: caloriesToReachGoal.toFixed(2),
                goalPace: `${weeklyRate} kg per week`,
                daysToReachGoal,
                dailyWaterIntake: `${waterIntake} L`
            },
        });
    } catch (error) {
        console.error('Error calculating user metrics:', error);
        res.status(500).json({
            status: false,
            data: {
                message: 'Internal server error'
            }
        });
    }
};


const home = async (req, res) => {
    const { userId } = req.body;

    try {
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({
                status: false,
                data: {
                    error: 'User not found'
                }
            });
        }
        const {
            name,
            goal,
            caloriesToReachGoal,
            dailyCalorieGoal,
            daysToReachGoal,
            isMetric,
            weightInKg,
            weightInLbs,
            profilePhoto,
            dailyConsumptionStats,
            calculationDate
        } = user;

        if (!caloriesToReachGoal || !dailyCalorieGoal || (daysToReachGoal === undefined || daysToReachGoal === null)) {
            return res.status(400).json({
                status: false,
                data: {
                    message: 'Missing essential user details'
                }
            });
        }

        // Get today's date in the correct format
        const today = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '/');

        // Get today's consumed calories from dailyConsumptionStats Map
        const totalCaloriesConsumed = Number(dailyConsumptionStats.get(today) || 0);
        const parsedDailyGoal = Number(dailyCalorieGoal);
        const remainingCalories = Number((parsedDailyGoal - totalCaloriesConsumed).toFixed(2));

        const weight = isMetric ? `${weightInKg} kg` : `${weightInLbs} lbs`;

        let goalHeading;
        if (goal === 'lose weight') {
            goalHeading = 'Calorie to burn';
        } else if (goal === 'maintain weight') {
            goalHeading = "Maintain";
        } else if (goal === 'gain weight') {
            goalHeading = 'Calorie to consume';
        } else {
            goalHeading = 'Calorie Goal';
        }

        let goalstatus;
        if (goal == 'maintain weight') {
            goalstatus = true
        } else {
            goalstatus = false
        }

        return res.status(200).json({
            status: true,
            data: {
                username: name,
                goalHeading,
                goalstatus,
                weight,
                caloriesToReachGoal,
                dailyCalorieGoal: parsedDailyGoal,
                daysToReachGoal,
                profilePhoto,
                remaining: remainingCalories,
                consumed: totalCaloriesConsumed,
                calculationDate
            }
        });

    } catch (error) {
        console.error('Error fetching user details:', error);
        return res.status(500).json({
            status: false,
            data: {
                message: 'Server error'
            }
        });
    }
};

const trackUser = async (req, res) => {
    const { userId } = req.body;

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingActivity = await UserActivity.findOne({
            userId,
            date: today,
        });

        if (!existingActivity) {
            const activity = new UserActivity({ userId, date: today });
            await activity.save();
        }

        // Retrieve all activities
        const activities = await UserActivity.find({ userId }).sort({ date: 1 });

        // Format dates and get unique dates only
        const uniqueDates = [...new Set(activities.map(activity => {
            const dateObj = activity.date;
            return `${dateObj.getDate().toString().padStart(2, '0')}-` +
                `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-` +
                `${dateObj.getFullYear()}`;
        }))];

        // Use unique dates length for streak calculation
        const totalStreak = uniqueDates.length;
        const startingDate = activities[0].date;
        const user = await User.findById(userId);
        const goalDays = user.daysToReachGoal || 0;

        const expectedEndDate = new Date(startingDate);
        expectedEndDate.setDate(expectedEndDate.getDate() + goalDays);

        const formattedEndDate = `${expectedEndDate.getDate().toString().padStart(2, '0')}-` +
            `${(expectedEndDate.getMonth() + 1).toString().padStart(2, '0')}-` +
            `${expectedEndDate.getFullYear()}`;

        const daysLeft = Math.max(goalDays - totalStreak, 0);

        res.status(200).json({
            status: true,
            message: 'Activity tracked and retrieved successfully',
            data: {
                userId,
                startingDate: uniqueDates[0],
                expectedEndDate: formattedEndDate,
                totalStreak,
                daysLeft,
                dates: uniqueDates,
            },
        });
    } catch (error) {
        console.error('Error tracking activity:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error',
        });
    }
};


const updateWeight = async (req, res) => {
    const { userId, newWeight } = req.body;

    try {
        // Find user first
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        // Store weight in user's preferred unit
        if (user.isMetric) {
            user.weightInKg = newWeight;
        } else {
            user.weightInLbs = newWeight;
        }

        // Get weight in kg for calculations
        const weightInKg = user.isMetric ? newWeight : newWeight * 0.453592;

        // Convert height to meters for BMI calculation
        let heightInM;
        if (user.isMetric) {
            heightInM = user.heightInCm / 100;
        } else {
            // Convert feet and inches to meters
            const heightInInches = (user.heightInFeet * 12) + user.heightInInches;
            heightInM = heightInInches * 0.0254;
        }

        // Recalculate BMI
        user.BMI = (weightInKg / (heightInM * heightInM)).toFixed(2);

        // Recalculate BMR using Mifflin-St Jeor Equation
        let BMR;
        if (user.gender.toLowerCase() === 'female') {
            BMR = (10 * weightInKg) + (6.25 * (heightInM * 100)) - (5 * user.age) - 161;
        } else {
            BMR = (10 * weightInKg) + (6.25 * (heightInM * 100)) - (5 * user.age) + 5;
        }
        user.BMR = BMR.toFixed(2);

        // Calculate TDEE based on activity level
        const activityMultipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            very: 1.725,
            extra: 1.9
        };
        const activityMultiplier = activityMultipliers[user.activityLevel] || 1.2;
        user.TDEE = (BMR * activityMultiplier).toFixed(2);

        // Calculate calories and days to reach goal
        const targetWeight = parseFloat(user.targetWeight);
        // Convert target weight to kg if needed
        const targetWeightKg = user.isMetric ? targetWeight : targetWeight * 0.453592;
        const weightDiff = Math.abs(weightInKg - targetWeightKg);
        const weightGainRate = user.weightGainRate || 0.5; // kg per week
        
        // Calculate days to reach goal (1 week = 7 days)
        user.daysToReachGoal = Math.ceil((weightDiff / weightGainRate) * 7);
        
        // Calculate total calories needed (7700 calories = 1 kg)
        user.caloriesToReachGoal = (weightDiff * 7700).toFixed(2);

        // Set daily calorie goal based on goal type
        if (user.goal === 'lose weight') {
            user.dailyCalorieGoal = Math.max(1200, (parseFloat(user.TDEE) - 500)).toFixed(2);
        } else if (user.goal === 'gain weight') {
            user.dailyCalorieGoal = (parseFloat(user.TDEE) + 500).toFixed(2);
        } else {
            user.dailyCalorieGoal = user.TDEE;
        }

        // Update calculation date
        user.calculationDate = new Date().toLocaleDateString('en-GB');

        // Save updated user
        await user.save();

        // Handle weight history
        let weightRecord = await Weight.findOne({ userId });
        
        if (weightRecord) {
            // Update existing record
            weightRecord.weight = newWeight;
            weightRecord.weightHistory.push({
                weight: newWeight,
                timestamp: new Date()
            });
            weightRecord.updatedAt = new Date();
        } else {
            // Create new record
            weightRecord = new Weight({
                userId,
                weight: newWeight,
                weightHistory: [{
                    weight: newWeight,
                    timestamp: new Date()
                }]
            });
        }

        // Save weight record
        await weightRecord.save();

        res.status(200).json({
            status: true,
            message: 'Weight updated successfully',
            data: {
                userId: user._id,
                weight: newWeight,
                isMetric: user.isMetric,
                BMI: user.BMI,
                BMR: user.BMR,
                TDEE: user.TDEE,
                caloriesToReachGoal: user.caloriesToReachGoal,
                dailyCalorieGoal: user.dailyCalorieGoal,
                daysToReachGoal: user.daysToReachGoal,
                weightHistory: weightRecord.weightHistory,
                lastUpdated: weightRecord.updatedAt
            }
        });
    } catch (error) {
        console.error('Error updating weight:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
};

const getWeightHistory = async (req, res) => {
    const { userId } = req.body;

    try {
        // Find user first
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        // Find weight record for the user
        const weightRecord = await Weight.findOne({ userId });
        
        if (!weightRecord) {
            // If no weight history exists, return current weight only
            const currentWeight = user.isMetric ? user.weightInKg : user.weightInLbs;
            return res.status(200).json({
                status: true,
                message: 'Weight history retrieved successfully',
                isMetric: user.isMetric,
                currentWeight,
                initialWeight: currentWeight,
                history: [{
                    weight: currentWeight,
                    date: new Date().toISOString().split('T')[0]
                }]
            });
        }

        // Format the weight history
        const history = weightRecord.weightHistory.map(entry => ({
            weight: entry.weight,
            date: entry.timestamp.toISOString().split('T')[0]
        })).sort((a, b) => new Date(b.date) - new Date(a.date));

        // Get initial weight (first recorded weight)
        const initialWeight = weightRecord.weightHistory.length > 0 
            ? weightRecord.weightHistory[0].weight 
            : weightRecord.weight;

        res.status(200).json({
            status: true,
            message: 'Weight history retrieved successfully',
            isMetric: user.isMetric,
            currentWeight: weightRecord.weight,
            initialWeight,
            history,
            lastUpdated: weightRecord.updatedAt
        });

    } catch (error) {
        console.error('Error fetching weight history:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
};

const checkUser = async (req, res) => {
    const { userId } = req.body
    try {
        const user = await User.findById(userId);
        if (user && user.age) {
            return res.status(200).json({
                status: true,
                data: {
                    message: 'User details exists',
                },
            })
        } else {
            return res.status(404).json({
                status: false,
                data: {
                    message: 'Please add details',
                },
            });
        }
    } catch (error) {
        console.error('Error checking user:', error);
        return res.status(500).json({
            status: false,
            data: {
                message: 'Internal Server Error',
            },
        });
    }
}

const getCalorieMetrics = async (req, res) => {
    const { userId } = req.body;

    try {
        const user = await User.findById({ _id: userId });
        if (!user) {
            return res.status(404).json({ status: false, data: { message: 'User not found' } });
        }

        // Extract user data with default values
        const goal = user.goal;
        const dailyCalorieGoal = parseFloat(user.dailyCalorieGoal);
        const weightGainRate = user.weightGainRate || 0.5;
        const daysToReachGoal = user.daysToReachGoal || 0;
        const caloriesToReachGoal = user.caloriesToReachGoal;

        // Get today's date in DD/MM/YYYY format
        const today = new Date();
        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

        // Initialize dailyConsumptionStats if it doesn't exist
        const stats = Object.fromEntries(user.dailyConsumptionStats || new Map());
        
        // Use Object.keys() instead of stats.keys()
        const dates = Object.keys(stats);
        const mostRecentDate = dates.length > 0 
            ? dates.reduce((a, b) => {
                const [dayA, monthA, yearA] = a.split('/').map(Number);
                const [dayB, monthB, yearB] = b.split('/').map(Number);
                const dateA = new Date(yearA, monthA - 1, dayA);
                const dateB = new Date(yearB, monthB - 1, dayB);
                return dateA > dateB ? a : b;
            })
            : todayFormatted;

        // Access stats directly as an object
        const consumedCalories = Number(stats[mostRecentDate] || 0);
        console.log(consumedCalories);
        
        // Rest of your code remains the same
        const remainingCalories = dailyCalorieGoal - consumedCalories;
        const weightrateInGrams = weightGainRate * 1000;
        const dailyWeightLoss = Math.round((weightrateInGrams * 7.7) / 7);
        const ratio = 0.38466918450132886;

        const responseData = {
            consumedCalories: consumedCalories,
            dailyTargetCalories: dailyCalorieGoal,
            remainingCalories: Math.max(0, remainingCalories),
            weightChangeRate: `${weightGainRate} kg per week`,
            daysLeft: daysToReachGoal,
            goal: goal,
            date: mostRecentDate,
            calorieStatus: remainingCalories > 0 ? 'under target' : 'over target',
            message: generateStatusMessage(goal, remainingCalories, daysToReachGoal),
            dailyWeightLoss: dailyWeightLoss,
            ratio: ratio,
            caloriesToReachGoal: caloriesToReachGoal
        };

        res.status(200).json({
            status: true,
            data: responseData
        });

    } catch (error) {
        console.error('Error calculating calorie metrics:', error);
        res.status(500).json({
            status: false,
            data: {
                message: 'Internal server error'
            }
        });
    }
};

const generateStatusMessage = (goal, remainingCalories, daysLeft) => {
    const absRemaining = Math.abs(remainingCalories);
    const roundedRemaining = Math.round(absRemaining);

    if (goal === 'gain weight') {
        if (remainingCalories > 0) {
            return `You still need to eat ${roundedRemaining} calories to reach your daily goal. ${daysLeft} days remaining to reach target weight.`;
        } else {
            return `You have exceeded your daily goal by ${roundedRemaining} calories. ${daysLeft} days remaining to reach target weight.`;
        }
    } else if (goal === 'lose weight') {
        if (remainingCalories > 0) {
            return `You can still eat ${roundedRemaining} calories to stay within your daily goal. ${daysLeft} days remaining to reach target weight.`;
        } else {
            return `You have exceeded your daily calorie limit by ${roundedRemaining} calories. ${daysLeft} days remaining to reach target weight.`;
        }
    }
    return `You have ${roundedRemaining} calories remaining for today.`;
};


const changecaloriesToReachGoal = async (req, res) => {
    const { userId, calorie ,day} = req.body;
    try {
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        // Calculate new value
        const caloriesToReachGoal = user.caloriesToReachGoal - calorie;

        // Assign the new value to the user object
        user.caloriesToReachGoal = caloriesToReachGoal;

        const daysToReachGoal = user.daysToReachGoal-day
        console.log(user.daysToReachGoal,"////////");
        user.daysToReachGoal = daysToReachGoal
        // Save the updated user object
        await user.save();

        return res.status(200).json({
            status: true,
            data: {
                userId,
                caloriesToReachGoal,
                daysToReachGoal
            }
        });
    } catch (error) {
        console.error('Error updating calories to reach goal:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
};

module.exports = { signupWithEmail, loginWithEmail, verifyToken, sendOTP, verifyOTP, loginWithGoogle, createProfile, calculateUserMetrics, home, trackUser, updateWeight, getWeightHistory, checkUser, getCalorieMetrics, changecaloriesToReachGoal };

