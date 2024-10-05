
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/userModel'); // Assuming you have a User model
require('dotenv').config()

// Function to hash the password
const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

// Function to generate JWT
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
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
          data:{
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
module.exports = { signupWithEmail,loginWithEmail };

