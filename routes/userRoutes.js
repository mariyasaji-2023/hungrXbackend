/**
 * HungerxApp API Routes
 * Main routing file for the application
 * @module routes/userRoutes
 */

const express = require('express');
const router = express.Router();
const upload = require('../middileware/multer')

// Controller imports
const userController = require('../controllers/userController');
const feedbackController = require('../controllers/feedbackController')
const searchController = require('../controllers/searchController')
const restaurantController = require('../controllers/restaurantController')
const waterController = require('../controllers/waterController')
const profileController = require('../controllers/profileController')
const mapboxController = require('../controllers/mapBoxController')
const menuController = require('../controllers/menuController')
const cartController = require('../controllers/cartController')
const commonfoodController = require('../controllers/commonfoodController')
const contactController = require('../controllers/contactController')
const appleController = require('../controllers/appleController')
const timeZoneController = require('../controllers/timezoneController')
const webhookController = require('../controllers/WebhookController');
const referralController  = require('../controllers/referralController')
const gptController = require('../controllers/gptController')
// Middleware imports
const authMiddleware = require('../middileware/auth');

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< AUTHENTICATION ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/signup/google', userController.loginWithGoogle)
router.post('/loginWithApple', appleController.loginWithApple)
router.post('/signup/email', userController.signupWithEmail)
router.post('/login/email', userController.loginWithEmail)
router.post('/verifyOTP', userController.verifyOTP)
router.post('/sendOTP', userController.sendOTP)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< USER PROFILE MANAGEMENT ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.put('/createProfile', upload.single('profilePhoto'), userController.createProfile)
router.post('/changecaloriesToReachGoal', userController.changecaloriesToReachGoal)
router.post('/calculate-metrics', userController.calculateUserMetrics)
router.post('/getCalorieMetrics', userController.getCalorieMetrics)
router.post('/trackuser', userController.trackUser)
router.post('/checkUser', userController.checkUser)
router.post('/home', userController.home)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< WEIGHT TRACKING ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/getWeightHistory', userController.getWeightHistory)
router.post('/updateWeight', userController.updateWeight)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< EAT SCREEN ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/eatScreenSearch', restaurantController.eatScreenSearchName)
router.post('/eatPage', restaurantController.getEatPage)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< DAILY INSIGHTS & HISTORY ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.get('/getConsumedFoodByDate', restaurantController.getConsumedFoodByDate)
router.post('/deleteDishFromMeal', restaurantController.deleteDishFromMeal)
router.post('/getUserhistory', restaurantController.getUserHistory)
router.get('/getMeals', restaurantController.getMeal)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< GROCERY & FOOD SEARCH ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/searchDishesForUser', searchController.searchDishesForUser)
router.post('/addConsumedFood', restaurantController.addConsumedFood)
router.post('/searchGrocery', restaurantController.searchGroceries)
router.post('/addHistory', restaurantController.addToHistory)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< CUSTOM FOOD ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/addUnknown', restaurantController.addUnknownFood)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< FEEDBACK ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/feedback', feedbackController.submitFeedback)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< PROFILE MANAGEMENT ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/updateGoalSetting', profileController.updateGoalSetting)
router.post('/updateBasicInfo', profileController.updateBasicInfo)
router.post('/profileScreen', profileController.profileScreen)
router.post('/goalSetting', profileController.goalGetting)
router.delete('/deleteUser', profileController.deleteUser)
router.post('/basicInfo', profileController.basicInfo)
router.post('/bug', feedbackController.reportBug)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< RESTAURANT ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/searchRestaurant', restaurantController.searchRestaurant)
router.post('/reqrestaurant', restaurantController.reqrestaurant)
router.post('/progressBar', restaurantController.progressBar)
router.get('/suggestions', restaurantController.suggestions)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<< LOCATION & MAPBOX INTEGRATION ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.get('/nearby', mapboxController.getNearbyRestaurants)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< MENU ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/getMenu', menuController.getMenu)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< CART MANAGEMENT ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.delete('/removeOneItem', cartController.removeOneItem)
router.post('/updateQuantity',cartController.updateQuantity)
router.post('/removeCart', cartController.removeCart)
router.post('/addToCart', cartController.addToCart)
router.post('/getCart', cartController.getCart)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<  COMMON FOOD ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/addCommonFoodToHistory', commonfoodController.addCommonFoodToHistory)
router.post('/addConsumedCommonFood', commonfoodController.addConsumedCommonFood)
router.post('/searchCommonfood', commonfoodController.searchCommonfood)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< WATER TRACKING ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/getWaterIntakeData', waterController.getWaterIntakeData)
router.delete('/removeWaterEntry', waterController.removeWaterEntry)
router.post('/addWater', waterController.addWaterIntake)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< HELP AND SUPPORT ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 

router.post('/apple-server-notifications',appleController.appleServerNotifications)
router.post('/submitIssue', contactController.submitIssue)
router.post('/timezone', timeZoneController.timezone)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< WEBHOOK & PAYMENT INTEGRATION ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/storeRevenueCatDetails',webhookController.storeRevenueCatDetails)
router.post('/verify', authMiddleware , webhookController.verify);
router.post('/store',authMiddleware, webhookController.store);
router.post('/webhook',webhookController.webhook)

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< REFERRAL SYSTEM ROUTES >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

router.post('/generateRef',referralController.generateRef)
router.post('/verifyRef',referralController.verifyRef)
router.post('/verifyExpiry',referralController.verifyExpiry)

router.post('/chat',gptController.chat)
router.post('/recipeHistory',gptController.recipeHistory)
router.post('/recipeHistoryDetails',gptController.recipeHistoryDetails)
router.post('/recordRecipeConsumption',gptController.recordRecipeConsumption)

module.exports = router;