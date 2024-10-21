
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/userModel'); // Assuming you have a User model
require('dotenv').config()
const twilio = require('twilio');

// Function to hash the password
const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

// Function to generate JWT
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const verifyToken = (req, res, next) => {
    // Get token from header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the decoded user id to the request object for use in other routes
        // req.userId = decoded.id;
        req.user = decoded
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token.' });
    }
};

// Signup with email and return JWT in response
const signupWithEmail = async (req, res) => {
    const { email, password, reenterPassword } = req.body;

    // Check if passwords match
    if (password !== reenterPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    try {
        // Check if email already exists
        let user = await User.findOne({ email });

        if (user && user.isVerified) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Hash the password
        const hashedPassword = await hashPassword(password);

        if (!user) {
            // Create new user
            user = new User({
                email,
                password: hashedPassword,
                isVerified: false,
            });
        } else {
            // Update existing user with new password
            user.password = hashedPassword;
            user.isVerified = false;
        }

        await user.save();

        // Generate JWT token
        const token = generateToken(user._id);

        // Send response with JWT token
        return res.status(201).json({
            data: {
                message: 'Registration successful.',
                token: token,
                userId: user._id,
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const loginWithEmail = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Compare the provided password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // Generate JWT token
        const token = generateToken(user._id);

        // Send response with JWT token
        return res.status(200).json({
            data: {
                message: 'Login successful.',
                token: token,
                userId: user._id,
            },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
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
        process.exit(1); // Stop execution if Twilio credentials are not set
    }

    if (!mobile) {
        return res.status(400).json({ error: "Mobile number is required" });
    }

    try {
        // Send OTP via Twilio
        client.verify.v2.services(serviceSid)
            .verifications.create({ to: `+${mobile}`, channel: 'sms' })
            .then(verification => {
                res.status(200).json({ message: 'OTP sent', verificationSid: verification.sid });
            })
            .catch(error => res.status(500).json({ error: error.message }));

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


const verifyOTP = async (req, res) => {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
        return res.status(400).json({ error: "Mobile number and OTP are required" });
    }

    try {
        // Verify OTP via Twilio
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
                // If user exists, update the verification status
                user.isVerified = true; // Optionally update any other fields if necessary
                await user.save();
            }

            res.status(200).json({
                message: 'OTP verified successfully. User has been created/updated.',
                userId: user._id, // Returning userId here
                user,
            });
        } else {
            res.status(400).json({ message: 'Invalid OTP' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
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
            message,
            token: jwtToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
            },
        });
    } catch (error) {
        console.error('Error in Google login/signup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const addName = async (req, res) => {
    const {
        userId,
        name,
        gender,
        height,
        isMetric,
        weight,
        mealsPerDay,
        goal,
        targetWeight,
        weightGainRate,
        activityLevel
    } = req.body;

    console.log('Request Body:', req.body); // Log the request

    try {
        const user = await User.findOne({ userId });


        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updateUserDetails = async (user) => {
            if (name) user.name = name;
            if (gender) user.gender = gender;

            // Store height along with its unit type
            if (height) {
                user.height = height;
                user.heightUnit = isMetric ? 'cm' : 'feet/inches';
            }

            if (weight) user.weight = weight;
            if (mealsPerDay) user.mealsPerDay = mealsPerDay;
            if (goal) user.goal = goal;
            if (goal && targetWeight) user.targetWeight = targetWeight;
            if (weightGainRate) user.weightGainRate = weightGainRate;
            if (activityLevel) user.activityLevel = activityLevel;

            await user.save();
            console.log('Updated User:', user); // Log updated user
        };

        if (user) await updateUserDetails(user);

        res.status(200).json({
            data: { message: 'User details have been updated successfully' },
        });
    } catch (error) {
        console.error('Error updating user details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


module.exports = { signupWithEmail, loginWithEmail, verifyToken, sendOTP, verifyOTP, loginWithGoogle, addName };

