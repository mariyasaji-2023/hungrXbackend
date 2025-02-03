const jwt = require("jsonwebtoken");
const AppleAuth = require("apple-signin-auth");
const User = require('../models/userModel');

// Generate Apple Client Secret
const generateClientSecret = () => {
    return jwt.sign(
        {
            iss: process.env.TEAM_ID,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 15777000, // 6 months validity
            aud: "https://appleid.apple.com",
            sub: process.env.CLIENT_ID,
        },
        process.env.PRIVATE_KEY,
        {
            algorithm: "ES256",
            keyid: process.env.KEY_ID,
        }
    );
};

const loginWithApple = async (req, res) => {

    const { id_token, code } = req.body;

    try {
        console.log(id_token,">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
        console.log(code,">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
        
        // Verify the ID token received from Apple
        const decoded = jwt.decode(id_token, { complete: true });
        if (!decoded) {
            return res.status(400).json({
                status: false,
                data: {
                    message: "Invalid ID token"
                }
            });
        }

        const { sub: appleId, appleEmail } = decoded.payload;
        const name = req.body.user?.name?.firstName 
            ? `${req.body.user.name.firstName} ${req.body.user.name.lastName || ''}`
            : undefined;

        // Generate Client Secret and exchange for access token
        const clientSecret = generateClientSecret();
        const appleResponse = await AppleAuth.getAuthorizationToken(code, {
            clientID: process.env.CLIENT_ID,
            clientSecret: clientSecret,
            redirectURI: "https://www.hungrx.com/login", // Replace with your redirect URI
        });

        // Find or create user
        let user = await User.findOne({ appleId });
        let message;

        if (!user) {
            // New user, sign them up
            user = new User({
                appleId,
                email,
                name,
                authProvider: 'apple'
            });
            await user.save();
            message = 'Signup successful';
        } else {
            // Existing user, update last login
            user.lastLoginAt = new Date();
            await user.save();
            message = 'Login successful';
        }

        // Generate JWT token
        const jwtToken = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );

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
                }
            }
        });

    } catch (error) {
        console.error('Error in Apple login/signup:', error);
        res.status(500).json({
            status: false,
            data: {
                message: 'Internal server error'
            }
        });
    }
};

module.exports = {loginWithApple}