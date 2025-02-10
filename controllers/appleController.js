const jwt = require("jsonwebtoken");
const AppleAuth = require("apple-signin-auth");
const User = require('../models/userModel');

// Generate Apple Client Secret
const generateClientSecret = () => {
    // Format the private key properly
    const privateKey = process.env.PRIVATE_KEY
        .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
        .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
        .replace(/(.{64})/g, '$1\n');

    try {
        return jwt.sign(
            {
                iss: process.env.TEAM_ID,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 15777000, // 6 months validity
                aud: "https://appleid.apple.com",
                sub: process.env.CLIENT_ID,
            },
            privateKey,
            {
                algorithm: "ES256",
                keyid: process.env.KEY_ID,
            }
        );
    } catch (error) {
        console.error('Error generating client secret:', error);
        throw error;
    }
};

const loginWithApple = async (req, res) => {
    const { id_token, code } = req.body;

    try {
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

        const { sub: appleId, email } = decoded.payload; // Fixed to use email from payload
        const name = req.body.user?.name?.firstName
            ? `${req.body.user.name.firstName} ${req.body.user.name.lastName || ''}`
            : undefined;

        // Generate Client Secret and exchange for access token
        let clientSecret;
        try {
            clientSecret = generateClientSecret();
        } catch (error) {
            return res.status(500).json({
                status: false,
                data: {
                    message: 'Error generating authentication credentials'
                }
            });
        }

        const appleResponse = await AppleAuth.getAuthorizationToken(code, {
            clientID: process.env.CLIENT_ID,
            clientSecret: clientSecret,
            redirectURI: "https://www.hungrx.com/login",
        });

        // Find or create user
        let user = await User.findOne({ appleId });
        let message;

        if (!user) {
            user = new User({
                appleId,
                email, // Using email from decoded token
                name,
                authProvider: 'apple'
            });
            await user.save();
            message = 'Signup successful';
        } else {
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

module.exports = { loginWithApple };