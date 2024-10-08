
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
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the decoded user id to the request object for use in other routes
        req.userId = decoded.id;
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

const addName = async (req, res) => {
    const { name } = req.body
    try {
        const user = new User({ name })
        await user.save()

        return res.status(201).json({ message: 'Name stored successfully', user });
    } catch (error) {
        return res.status(500).json({ message: 'Error saving name', error });
    }
}

const accountSid = process.env.TWILIO_ACCOUNT_SID;  // Twilio Account SID
const authToken = process.env.TWILIO_AUTH_TOKEN;    // Twilio Auth Token
const serviceSid = process.env.TWILIO_SERVICE_SID;  // Twilio Verify Service SID

const client = twilio(accountSid, authToken);

const sendOTP = (req, res) => {
    const { phoneNumber } = req.body;

    client.verify.v2.services(serviceSid)
        .verifications.create({ to: `+${phoneNumber}`, channel: 'sms' })
        .then(verification => res.status(200).json({ message: 'OTP sent', verificationSid: verification.sid }))
        .catch(error => res.status(500).json({ error: error.message }));
}

const verifyOTP = (req, res) => {
    const { phoneNumber, otp } = req.body;

    client.verify.v2.services(serviceSid)
        .verificationChecks.create({ to: `+${phoneNumber}`, code: otp })
        .then(verification_check => {
            if (verification_check.status === 'approved') {
                res.status(200).json({ message: 'OTP verified successfully' });
            } else {
                res.status(400).json({ message: 'Invalid OTP' });
            }
        })
        .catch(error => res.status(500).json({ error: error.message }));
}
module.exports = { signupWithEmail, loginWithEmail, addName, verifyToken, sendOTP, verifyOTP };

