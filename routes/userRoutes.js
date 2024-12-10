const express = require('express');
const router = express.Router();
const upload = require('../middileware/multer')
const userController = require('../controllers/userController');
const feedbackController = require('../controllers/feedbackController')
const searchController = require('../controllers/searchController')
const restaurantController = require('../controllers/restaurantController')
const waterController = require('../controllers/waterController')
const profileController = require ('../controllers/profileController')

router.post('/signup/email', userController.signupWithEmail);
router.post('/login/email',userController.loginWithEmail)
router.post('/sendOTP',userController.sendOTP)
router.post('/verifyOTP',userController.verifyOTP)
router.post('/signup/google',userController.loginWithGoogle)
router.put('/createProfile', upload.single('profilePhoto'), userController.createProfile);
router.post('/calculate-metrics',userController.calculateUserMetrics);
router.post('/home', userController.home);
router.post('/trackuser',userController.trackUser)
router.post('/updateWeight',userController.updateWeight)
router.post('/getWeightHistory',userController.getWeightHistory)
router.post('/feedback',feedbackController.submitFeedback)
router.post('/checkUser',userController.checkUser)
router.post('/searchDishesForUser',searchController.searchDishesForUser)
router.post('/eatPage',restaurantController.getEatPage)
router.post('/initialize',waterController.initializeWaterTracking)
router.post('/eatScreenSearch',restaurantController.eatScreenSearchName)
router.get('/getMeals',restaurantController.getMeal)
router.post('/searchGrocery',restaurantController.searchGroceries)
router.post('/addHistory',restaurantController.addToHistory)
router.post('/getUserhistory',restaurantController.getUserHistory)
router.post('/addConsumedFood',restaurantController.addConsumedFood)
router.post('/addUnknown',restaurantController.addUnknownFood)
router.post('/getConsumedFoodByDate',restaurantController.getConsumedFoodByDate)
router.post('/deleteDishFromMeal',restaurantController.deleteDishFromMeal)
router.post('/basicInfo',profileController.basicInfo)
router.post('/profileScreen',profileController.profileScreen)
router.post('/updateBasicInfo',profileController.updateBasicInfo)
router.post('/goalSetting',profileController.goalGetting)
router.post('/updateGoalSetting',profileController.updateGoalSetting)


module.exports = router;