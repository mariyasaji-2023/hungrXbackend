const express = require('express');
const router = express.Router();
const upload = require('../middileware/multer')
const userController = require('../controllers/userController');
const feedbackController = require('../controllers/feedbackController')
const searchController = require('../controllers/searchController')
const restaurantController = require('../controllers/restaurantController')
const waterController = require('../controllers/waterController')
const profileController = require('../controllers/profileController')
const mapboxController = require('../controllers/mapBoxController')
const menuController = require('../controllers/menuController')
const cartController = require ('../controllers/cartController')


router.post('/signup/email', userController.signupWithEmail);
router.post('/login/email', userController.loginWithEmail)
router.post('/sendOTP', userController.sendOTP)
router.post('/verifyOTP', userController.verifyOTP)
router.post('/signup/google', userController.loginWithGoogle)
router.put('/createProfile', upload.single('profilePhoto'), userController.createProfile);
router.post('/calculate-metrics', userController.calculateUserMetrics);
router.post('/home', userController.home);
router.post('/trackuser', userController.trackUser)
router.post('/updateWeight', userController.updateWeight)
router.post('/getWeightHistory', userController.getWeightHistory)
router.post('/feedback', feedbackController.submitFeedback)
router.post('/checkUser', userController.checkUser)
router.post('/searchDishesForUser', searchController.searchDishesForUser)
router.post('/eatPage', restaurantController.getEatPage)
router.post('/initialize', waterController.initializeWaterTracking)
router.post('/eatScreenSearch', restaurantController.eatScreenSearchName)
router.get('/getMeals', restaurantController.getMeal)
router.post('/searchGrocery', restaurantController.searchGroceries)
router.post('/addHistory', restaurantController.addToHistory)
router.post('/getUserhistory', restaurantController.getUserHistory)
router.post('/addConsumedFood', restaurantController.addConsumedFood)
router.post('/addUnknown', restaurantController.addUnknownFood)
router.post('/getConsumedFoodByDate', restaurantController.getConsumedFoodByDate)
router.post('/deleteDishFromMeal', restaurantController.deleteDishFromMeal)
router.post('/basicInfo', profileController.basicInfo)
router.post('/profileScreen', profileController.profileScreen)
router.post('/updateBasicInfo', profileController.updateBasicInfo)
router.post('/goalSetting', profileController.goalGetting)
router.post('/updateGoalSetting', profileController.updateGoalSetting)
router.delete('/deleteUser', profileController.deleteUser)
router.post('/bug', feedbackController.reportBug)
router.post('/searchRestaurant',restaurantController.searchRestaurant)
router.get('/nearby',mapboxController.getNearbyRestaurants)
router.get('/suggestions',restaurantController.suggestions)
router.post('/getMenu',menuController.getMenu)
router.post('/addToCart',cartController.addToCart)
router.post('/removeCart',cartController.removeCart)
router.post('/getCart',cartController.getCart)
router.delete('/removeOneItem',cartController.removeOneItem)

module.exports = router;