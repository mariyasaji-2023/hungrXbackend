const axios = require('axios');
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DB_URI);

// Default categories if database fetch fails
const DEFAULT_CATEGORIES = {
    'fast-food': 'Fast food restaurant',
    'pizza': 'Pizza restaurant',
    'burger': 'Burger restaurant',
    'coffee': 'Coffee shop',
    'restaurant': 'Restaurant',
    'Tacobell': 'Tacobell',
    'Chipotle': 'Chipotle'
};

const getValidCategories = async () => {
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const categoriesCollection = db.collection("categories");

        const categories = await categoriesCollection.find({}).toArray();
        
        if (!categories || categories.length === 0) {
            return DEFAULT_CATEGORIES;
        }

        const validCategories = {};
        categories.forEach(category => {
            validCategories[category.name] = category.name;
        });

        return validCategories;
    } catch (error) {
        console.error('Error fetching categories:', error);
        return DEFAULT_CATEGORIES;
    }
};

const generateSessionToken = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const getBoundingBox = (lat, lon, radius) => {
    const radDeg = (radius / 1000) / 111.32;
    
    const minLon = Number(lon) - radDeg / Math.cos(lat * Math.PI / 180);
    const maxLon = Number(lon) + radDeg / Math.cos(lat * Math.PI / 180);
    const minLat = Number(lat) - radDeg;
    const maxLat = Number(lat) + radDeg;

    return [
        minLon.toFixed(6),
        minLat.toFixed(6),
        maxLon.toFixed(6),
        maxLat.toFixed(6)
    ].join(',');
};

const fetchRestaurants = async (longitude, latitude, radius) => {
    try {
        // Using the same suggest endpoint with 'restaurant' query
        const searchUrl = `https://api.mapbox.com/search/v1/suggest/restaurant`;
        const sessionToken = generateSessionToken();
        
        console.log('Searching for restaurants around coordinates:', { longitude, latitude, radius });
        
        const response = await axios.get(searchUrl, {
            params: {
                access_token: process.env.MAPBOX_ACCESS_TOKEN,
                proximity: `${longitude},${latitude}`,
                types: 'poi',
                limit: 50,  // Increased limit for single call
                language: 'en',
                bbox: getBoundingBox(latitude, longitude, radius),
                session_token: sessionToken
            }
        });

        if (!response.data?.suggestions) {
            console.log('No suggestions found');
            return [];
        }

        const restaurants = response.data.suggestions
            .filter(suggestion => {
                const isValid = suggestion.feature_name && suggestion.description;
                if (!isValid) {
                    console.log('Invalid suggestion missing required fields:', suggestion);
                }
                return isValid;
            })
            .map(suggestion => ({
                name: suggestion.feature_name,
                address: suggestion.description || '',
                distance: suggestion.distance || 0,
                category: suggestion.category_ids || []
            }));

        console.log(`Found ${restaurants.length} valid restaurants`);
        return restaurants;

    } catch (error) {
        console.error('Error fetching restaurants:', error);
        if (error.response) {
            console.error('Error response:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        return [];
    }
};



const findRestaurantInDatabase = async (restaurantName, Restaurant) => {
    const sanitizedName = restaurantName
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ');

    // Try exact match first
    let dbRestaurant = await Restaurant.findOne({
        restaurantName: {
            $regex: `^${sanitizedName}$`,
            $options: 'i'
        }
    });

    if (dbRestaurant) {
        console.log(`Found exact match for: ${restaurantName}`);
        return dbRestaurant;
    }

    // If no exact match, try more specific partial match
    const nameParts = sanitizedName.split(' ');
    if (nameParts.length > 0) {
        // For single word names, require at least 60% match
        if (nameParts.length === 1 && nameParts[0].length > 3) {
            const minLength = Math.ceil(nameParts[0].length * 0.6);
            const regexPattern = `^${nameParts[0].substring(0, minLength)}`;
            
            dbRestaurant = await Restaurant.findOne({
                restaurantName: {
                    $regex: regexPattern,
                    $options: 'i'
                }
            });
        } 
        // For multi-word names, match full words only
        else if (nameParts.length > 1) {
            const significantParts = nameParts.filter(part => part.length >= 3);
            if (significantParts.length > 0) {
                const regexPattern = significantParts.map(part => `(?=.*\\b${part}\\b)`).join('');
                
                dbRestaurant = await Restaurant.findOne({
                    restaurantName: {
                        $regex: regexPattern,
                        $options: 'i'
                    }
                });
            }
        }
    }

    if (dbRestaurant) {
        // Additional validation to prevent false positives
        const dbNameParts = dbRestaurant.restaurantName.toLowerCase().split(' ');
        const searchNameParts = sanitizedName.split(' ');
        
        if (Math.abs(dbNameParts.length - searchNameParts.length) > 1) {
            console.log(`Rejected potential false positive match: ${restaurantName} -> ${dbRestaurant.restaurantName}`);
            return null;
        }
    }

    return dbRestaurant;
};

// Helper function to get all restaurants from Mapbox
const getAllRestaurants = async (longitude, latitude, radius, category) => {
    const searchTerms = [
        "restaurant",
        "McDonald's",
        "Burger King",
        "Wendy's",
        "pizza",
        "Starbucks",
        "Fast food",
        "Chinese restaurant",
        "Indian restaurant",
        "cafe",
        "diner"
    ];

    console.log('Starting search with terms:', searchTerms);
    const results = await Promise.all(
        searchTerms.map(term => fetchRestaurantsByType(term, longitude, latitude, radius))
    );

    // Deduplicate restaurants based on name
    const uniqueRestaurants = new Map();
    results.flat().forEach(restaurant => {
        if (!uniqueRestaurants.has(restaurant.name)) {
            uniqueRestaurants.set(restaurant.name, restaurant);
        }
    });

    return Array.from(uniqueRestaurants.values());
};


const getNearbyRestaurants = async (req, res) => {
    let isConnected = false;
    try {
        await client.connect();
        isConnected = true;
        
        console.log('Connected to MongoDB successfully');
        const db = client.db(process.env.DB_NAME);
        const Restaurant = db.collection("restaurants");
        
        const { longitude, latitude, radius = 30000, category = 'all' } = req.query;

        console.log('Search parameters:', { longitude, latitude, radius, category });

        if (!longitude || !latitude) {
            return res.status(400).json({ 
                success: false, 
                message: 'Longitude and latitude are required' 
            });
        }

        // Single API call to get restaurants
        const mapboxRestaurants = await fetchRestaurants(longitude, latitude, radius);
        console.log(`Found ${mapboxRestaurants.length} restaurants from Mapbox`);

        // Check each restaurant against our database
        const matchedRestaurants = [];
        for (const restaurant of mapboxRestaurants) {
            const dbRestaurant = await findRestaurantInDatabase(restaurant.name, Restaurant);

            if (dbRestaurant) {
                const restaurantDetails = {
                    ...dbRestaurant,
                    address: restaurant.address,
                    distance: restaurant.distance,
                    mapboxCategories: restaurant.category
                };
                
                // Apply category filter if specified
                if (category !== 'all' && dbRestaurant.category !== category) {
                    continue;
                }
                
                if (!restaurantDetails.logo) {
                    restaurantDetails.logo = '/restaurant-default-logo/restaurantdefaultlogo.webp';
                }

                matchedRestaurants.push(restaurantDetails);
                console.log(`Matched restaurant: ${restaurant.name} with database name: ${dbRestaurant.restaurantName}`);
            }
        }
        
        console.log(`Found ${matchedRestaurants.length} matching restaurants in our database`);
        
        const sortedRestaurants = matchedRestaurants.sort((a, b) => a.distance - b.distance);

        return res.status(200).json({ 
            success: true, 
            data: sortedRestaurants,
            total: sortedRestaurants.length
        });

    } catch (error) {
        console.error('Error fetching nearby restaurants:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error fetching nearby restaurants'
        });
    } finally {
        if (isConnected) {
            await client.close().catch(err => 
                console.error('Error closing MongoDB connection:', err)
            );
        }
    }
};
module.exports = {
    getNearbyRestaurants
};