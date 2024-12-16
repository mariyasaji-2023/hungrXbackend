const fs = require('fs');
const jwt = require('jsonwebtoken');
const AppleAuth = require('apple-auth'); // Make sure you have this package installed
const User = require('./models/User'); // Replace with the actual path to your User model
const config = require('./config'); // Replace with the actual path to your config

// Load Apple private key
let privateKey;
try {
    privateKey = fs.readFileSync(config.apple.privateKeyPath);
} catch (error) {
    console.error('Error loading Apple private key:', error);
    throw error;
}

// Generate JWT token for user
function generateJWT(user) {
    return jwt.sign(
        {
            id: user._id,
            appleId: user.appleId,
            email: user.email
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );
}

// Sign in with Apple function
async function signInWithApple(req, res) {
    try {
        const { authorization, user: userDetails } = req.body;

        if (!authorization) {
            return res.status(400).json({
                status: false,
                message: 'Apple authorization token is required'
            });
        }

        // Verify Apple ID token
        const appleIdTokenClaims = await AppleAuth.verifyIdToken(authorization, {
            audience: config.apple.clientId,
            ignoreExpiration: true // Handle token expiration as needed
        });

        // Get user info from token
        const { sub: appleId, email, email_verified } = appleIdTokenClaims;

        // Find or create user
        let user = await User.findOne({ appleId });

        if (!user) {
            // Create new user
            user = new User({
                appleId,
                email,
                isEmailVerified: email_verified,
                name: userDetails?.name // Name from Apple only comes in first sign in
            });
        } else {
            // Update existing user
            user.lastLoginAt = new Date();
            if (userDetails?.name) {
                user.name = userDetails.name;
            }
        }

        await user.save();

        // Generate access token
        const accessToken = generateJWT(user);

        return res.status(200).json({
            status: true,
            data: {
                accessToken,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    isEmailVerified: user.isEmailVerified
                }
            }
        });

    } catch (error) {
        console.error('Apple authentication error:', error);
        return res.status(401).json({
            status: false,
            message: 'Authentication failed'
        });
    }
}

// Get user profile function
async function getUserProfile(req, res) {
    try {
        const user = await User.findById(req.user.id).select('-appleId');

        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            status: true,
            data: { user }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
}

module.exports = {
    signInWithApple,
    getUserProfile
};
