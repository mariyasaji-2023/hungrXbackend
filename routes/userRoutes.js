const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/signup/email', userController.signupWithEmail);
router.post('/login/email',userController.loginWithEmail)
router.post('/sendOTP',userController.sendOTP)
router.post('/verifyOTP',userController.verifyOTP)
router.post('/addname',userController.verifyToken, userController.addName)


module.exports = router;