const axios = require('axios');
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DB_URI);

const DEFAULT_CATEGORIES = {
    'fast-food': 'Fast food restaurant',
    'pizza': 'Pizza restaurant',
    'burger': 'Burger restaurant',
    'coffee': 'Coffee shop',
    'restaurant': 'Restaurant',
    'Tacobell': 'Tacobell',
    'Chipotle': 'Chipotle',
    "Wendys":"Wendys",
    "Mcdonalds":"McDonald's"
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
        const searchUrl = `https://api.mapbox.com/search/v1/suggest/restaurant`;
        const sessionToken = generateSessionToken();
        
        console.log('Making request with params:', {
            longitude,
            latitude,
            radius,
            bbox: getBoundingBox(latitude, longitude, radius)
        });

        const response = await axios.get(searchUrl, {
            params: {
                access_token: process.env.MAPBOX_ACCESS_TOKEN,
                proximity: `${longitude},${latitude}`,
                types: 'poi',
                limit: 50,
                language: 'en',
                bbox: getBoundingBox(latitude, longitude, radius),
                session_token: sessionToken
            }
        });

        if (!response.data?.suggestions) {
            console.log('No suggestions found in response:', response.data);
            return [];
        }

        // Log the first suggestion to see its structure
        if (response.data.suggestions.length > 0) {
            console.log('Sample suggestion structure:', JSON.stringify(response.data.suggestions[0], null, 2));
        }

        // Modified filter to be more lenient
        const restaurants = response.data.suggestions
            .filter(suggestion => {
                // Log each suggestion that's being filtered
                console.log('Processing suggestion:', {
                    name: suggestion.feature_name,
                    hasName: !!suggestion.feature_name,
                    hasDesc: !!suggestion.description,
                    categories: suggestion.poi_category
                });

                // More lenient validation
                return suggestion.feature_name && suggestion.description;
            })
            .map(suggestion => ({
                name: suggestion.feature_name,
                address: suggestion.description,
                distance: suggestion.distance || 0,
                category: suggestion.poi_category || [],
                mapboxId: suggestion.mapbox_id || '',
                context: suggestion.context || {}
            }));

        console.log(`Found ${restaurants.length} valid restaurants after filtering`);
        
        // If still empty, log the entire response for debugging
        if (restaurants.length === 0) {
            console.log('Full response data:', JSON.stringify(response.data, null, 2));
        }

        return restaurants;

    } catch (error) {
        console.error('Error fetching restaurants:', error);
        if (error.response) {
            console.error('Error response:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
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
        return dbRestaurant;
    }

    // If no exact match, try partial match
    const nameParts = sanitizedName.split(' ').filter(part => part.length >= 3);
    if (nameParts.length > 0) {
        const regexPattern = nameParts.map(part => `(?=.*\\b${part}\\b)`).join('');
        
        dbRestaurant = await Restaurant.findOne({
            restaurantName: {
                $regex: regexPattern,
                $options: 'i'
            }
        });
    }

    return dbRestaurant;
};

const getNearbyRestaurants = async (req, res) => {
    let isConnected = false;
    try {
        await client.connect();
        isConnected = true;
        
        const db = client.db(process.env.DB_NAME);
        const Restaurant = db.collection("restaurants");
        
        const { longitude, latitude, radius = 30000, category = 'all' } = req.query;

        if (!longitude || !latitude) {
            return res.status(400).json({ 
                success: false, 
                message: 'Longitude and latitude are required' 
            });
        }

        // Single API call to get restaurants
        const mapboxRestaurants = await fetchRestaurants(longitude, latitude, radius);
        console.log(`Found ${mapboxRestaurants.length} restaurants from Mapbox`);

        // Process results in batches
        const batchSize = 10;
        const matchedRestaurants = [];
        
        for (let i = 0; i < mapboxRestaurants.length; i += batchSize) {
            const batch = mapboxRestaurants.slice(i, i + batchSize);
            const batchPromises = batch.map(restaurant => 
                findRestaurantInDatabase(restaurant.name, Restaurant)
                    .then(dbRestaurant => {
                        if (dbRestaurant && (category === 'all' || dbRestaurant.category === category)) {
                            console.log('Matched restaurant:', restaurant.name,"/////////////////");
                            return {
                                ...dbRestaurant,
                                address: restaurant.address,
                                distance: restaurant.distance,
                                mapboxCategories: restaurant.category,
                                logo: dbRestaurant.logo || '/restaurant-default-logo/restaurantdefaultlogo.webp'
                            };
                        }
                        return null;
                    })
            );
            
            const batchResults = await Promise.all(batchPromises);
            matchedRestaurants.push(...batchResults.filter(Boolean));
        }

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