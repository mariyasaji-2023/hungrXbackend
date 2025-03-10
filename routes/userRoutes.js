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
const cartController = require('../controllers/cartController')
const commonfoodController = require('../controllers/commonfoodController')
const contactController = require('../controllers/contactController')
const appleController = require('../controllers/appleController')
const timeZoneController = require('../controllers/timezoneController')
const webhookController = require('../controllers/WebhookController');
const authMiddleware = require('../middileware/auth');

//============================ Authentication Screen Route ============================

router.post('/signup/google', userController.loginWithGoogle)
router.post('/loginWithApple', appleController.loginWithApple)
router.post('/signup/email', userController.signupWithEmail)
router.post('/login/email', userController.loginWithEmail)
router.post('/verifyOTP', userController.verifyOTP)
router.post('/sendOTP', userController.sendOTP)

//============================ Create Profile Screen Route ============================

router.put('/createProfile', upload.single('profilePhoto'), userController.createProfile)
router.post('/calculate-metrics', userController.calculateUserMetrics)
router.post('/getCalorieMetrics', userController.getCalorieMetrics)
router.post('/trackuser', userController.trackUser)
router.post('/checkUser', userController.checkUser)
router.post('/home', userController.home)
router.post('/changecaloriesToReachGoal', userController.changecaloriesToReachGoal)

//============================ Weight Screen Route ============================

router.post('/getWeightHistory', userController.getWeightHistory)
router.post('/updateWeight', userController.updateWeight)


router.post('/searchDishesForUser', searchController.searchDishesForUser)
router.post('/eatPage', restaurantController.getEatPage)
router.post('/eatScreenSearch', restaurantController.eatScreenSearchName)
router.get('/getMeals', restaurantController.getMeal)
router.post('/searchGrocery', restaurantController.searchGroceries)
router.post('/addHistory', restaurantController.addToHistory)
router.post('/getUserhistory', restaurantController.getUserHistory)
router.post('/addConsumedFood', restaurantController.addConsumedFood)
router.post('/addUnknown', restaurantController.addUnknownFood)
router.post('/getConsumedFoodByDate', restaurantController.getConsumedFoodByDate)
router.post('/deleteDishFromMeal', restaurantController.deleteDishFromMeal)
router.post('/progressBar', restaurantController.progressBar)

//============================ Feedback Screen Route ============================

router.post('/feedback', feedbackController.submitFeedback)

//============================ Profile Screen Route ============================

router.post('/updateGoalSetting', profileController.updateGoalSetting)
router.post('/updateBasicInfo', profileController.updateBasicInfo)
router.post('/profileScreen', profileController.profileScreen)
router.post('/goalSetting', profileController.goalGetting)
router.delete('/deleteUser', profileController.deleteUser)
router.post('/basicInfo', profileController.basicInfo)
router.post('/bug', feedbackController.reportBug)

//============================ Restaurant Screen Route ============================

router.post('/searchRestaurant', restaurantController.searchRestaurant)
router.post('/reqrestaurant', restaurantController.reqrestaurant)
router.get('/suggestions', restaurantController.suggestions)

//============================ Mapbox integration Route ============================

router.get('/nearby', mapboxController.getNearbyRestaurants)

//============================ Menu Screen Route ============================

router.post('/getMenu', menuController.getMenu)

//============================ Cart Screen Route ============================

router.delete('/removeOneItem', cartController.removeOneItem)
router.post('/removeCart', cartController.removeCart)
router.post('/addToCart', cartController.addToCart)
router.post('/getCart', cartController.getCart)

//============================ Common Food Route ============================

router.post('/searchCommonfood', commonfoodController.searchCommonfood)
router.post('/addConsumedCommonFood', commonfoodController.addConsumedCommonFood)
router.post('/addCommonFoodToHistory', commonfoodController.addCommonFoodToHistory)

//============================ Water screen Route ============================

router.post('/getWaterIntakeData', waterController.getWaterIntakeData)
router.delete('/removeWaterEntry', waterController.removeWaterEntry)
router.post('/addWater', waterController.addWaterIntake)

//============================ Help and support screen ============================

router.post('/submitIssue', contactController.submitIssue)
router.post('/apple-server-notifications',appleController.appleServerNotifications)
router.post('/timezone', timeZoneController.timezone)


// Public routes
router.post('/verify', authMiddleware , webhookController.verify);
router.post('/store',authMiddleware, webhookController.store);
router.post('/webhook',webhookController.webhook)
router.post('/storeRevenueCatDetails',webhookController.storeRevenueCatDetails)

module.exports = router;