const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middileware/authMiddleware')

router.post('/signup/email', userController.signupWithEmail);
router.post('/login/email',userController.loginWithEmail)
router.post('/sendOTP',userController.sendOTP)
router.post('/verifyOTP',userController.verifyOTP)
router.post('/signup/google',userController.loginWithGoogle)
router.get('/signup/protect', authMiddleware.authenticateToken, userController.loginWithGoogleGet);


module.exports = router;