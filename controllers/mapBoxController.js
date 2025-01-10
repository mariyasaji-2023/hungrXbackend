const axios = require('axios');
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DB_URI);

const DEFAULT_CATEGORIES = {
    'fast-food': 'Fast food restaurant',
    'pizza': 'Pizza restaurant',
    'burger': 'Burger restaurant',
    'coffee': 'Coffee shop',
    'restaurant': 'Restaurant',
    'Taco Bell': 'Taco Bell',
    'Chipotle': 'Chipotle',
    "Wendys":"Wendys",
    "McDonald's":"McDonald's",
    "Popeyes":"Popeyes",
    "Dominos":"Dominos"
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
        
        console.log('Making Mapbox API request with params:', {
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

        console.log('Total Mapbox suggestions received:', response.data?.suggestions?.length || 0);

        // Log all raw suggestions first
        console.log('Raw suggestions:', JSON.stringify(response.data?.suggestions, null, 2));

        const restaurants = response.data.suggestions
            .filter(suggestion => {
                const keep = suggestion.feature_name && suggestion.description;
                console.log('Filtering suggestion:', {
                    name: suggestion.feature_name,
                    description: suggestion.description,
                    kept: keep,
                    reason: !keep ? (
                        !suggestion.feature_name ? 'Missing name' :
                        !suggestion.description ? 'Missing description' :
                        'Unknown'
                    ) : 'Kept'
                });
                return keep;
            })
            .map(suggestion => {
                const restaurant = {
                    name: suggestion.feature_name,
                    address: suggestion.description,
                    distance: suggestion.distance || 0,
                    category: suggestion.poi_category || [],
                    mapboxId: suggestion.mapbox_id || '',
                    context: suggestion.context || {}
                };
                console.log('Mapped restaurant:', restaurant);
                return restaurant;
            });

        console.log(`Found ${restaurants.length} valid restaurants after filtering`);
        return restaurants;

    } catch (error) {
        console.error('Error fetching restaurants:', error);
        throw error;
    }
};

const findRestaurantInDatabase = async (restaurantName, Restaurant) => {
    // Step 1: Initial sanitization
    const sanitizedName = restaurantName
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ');

    console.log('Looking for restaurant:', {
        original: restaurantName,
        sanitized: sanitizedName
    });

    // Step 2: Common chain name mappings
    const chainMappings = {
        'mcdonalds': 'McDonald\'s',
        'mcdonald\'s': 'McDonald\'s',
        'chipotle mexican grill': 'Chipotle Mexican Grill',
        'chipotle': 'Chipotle Mexican Grill',
        'starbucks coffee': 'Starbucks',
        'starbucks': 'Starbucks'
    };

    // Check if it's a known chain
    const mappedName = chainMappings[sanitizedName];
    if (mappedName) {
        const chainMatch = await Restaurant.findOne({
            restaurantName: mappedName
        });
        
        if (chainMatch) {
            console.log('Found chain match:', chainMatch.restaurantName);
            return chainMatch;
        }
    }

    // Step 3: Try exact match (case-insensitive)
    let dbRestaurant = await Restaurant.findOne({
        restaurantName: {
            $regex: `^${sanitizedName}$`,
            $options: 'i'
        }
    });

    if (dbRestaurant) {
        console.log('Found exact match:', dbRestaurant.restaurantName);
        return dbRestaurant;
    }

    // Step 4: Try matching without special characters
    const strippedName = restaurantName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim();

    dbRestaurant = await Restaurant.findOne({
        $or: [
            {
                restaurantName: {
                    $regex: strippedName,
                    $options: 'i'
                }
            },
            {
                restaurantName: {
                    $regex: strippedName.split(' ')[0],
                    $options: 'i'
                }
            }
        ]
    });

    if (dbRestaurant) {
        console.log('Found stripped match:', dbRestaurant.restaurantName);
        return dbRestaurant;
    }

    // Step 5: Try partial match with main words
    const significantWords = sanitizedName.split(' ')
        .filter(word => word.length > 2)
        .filter(word => !['the', 'and', 'restaurant', 'cafe', 'coffee', 'shop'].includes(word));

    if (significantWords.length > 0) {
        const partialMatches = await Restaurant.find({
            restaurantName: {
                $regex: significantWords.map(word => `(?=.*${word})`).join(''),
                $options: 'i'
            }
        }).toArray();

        if (partialMatches.length > 0) {
            // Get the closest match by length
            dbRestaurant = partialMatches.reduce((closest, current) => {
                const closestDiff = Math.abs(closest.restaurantName.length - restaurantName.length);
                const currentDiff = Math.abs(current.restaurantName.length - restaurantName.length);
                return currentDiff < closestDiff ? current : closest;
            });
            
            console.log('Found partial match:', dbRestaurant.restaurantName);
            return dbRestaurant;
        }
    }

    console.log('No match found for:', restaurantName);
    return null;
};

const getNearbyRestaurants = async (req, res) => {
    let isConnected = false;
    try {
        await client.connect();
        isConnected = true;
        
        const db = client.db(process.env.DB_NAME);
        const Restaurant = db.collection("restaurants");
        
        const { longitude, latitude, radius = 30000, category = 'all' } = req.query;

        console.log('Starting search with params:', { longitude, latitude, radius, category });

        const mapboxRestaurants = await fetchRestaurants(longitude, latitude, radius);
        console.log(`Retrieved ${mapboxRestaurants.length} restaurants from Mapbox`);

        const matchedRestaurants = [];
        const batchSize = 10;
        
        for (let i = 0; i < mapboxRestaurants.length; i += batchSize) {
            const batch = mapboxRestaurants.slice(i, i + batchSize);
            console.log(`Processing batch ${i/batchSize + 1} of ${Math.ceil(mapboxRestaurants.length/batchSize)}`);
            
            const batchPromises = batch.map(restaurant => 
                findRestaurantInDatabase(restaurant.name, Restaurant)
                    .then(dbRestaurant => {
                        if (dbRestaurant && (category === 'all' || dbRestaurant.category === category)) {
                            console.log('Successfully matched and included:', restaurant.name);
                            // ... rest of the processing
                            return {
                                _id: dbRestaurant._id,
                                restaurantName: dbRestaurant.restaurantName,
                                logo: dbRestaurant.logo?.startsWith('http') 
                                    ? dbRestaurant.logo 
                                    : `${process.env.BASE_URL}/public${dbRestaurant.logo || '/restaurant-default-logo/restaurantdefaultlogo.webp'}`,
                                createdAt: dbRestaurant.createdAt,
                                updatedAt: dbRestaurant.updatedAt,
                                __v: dbRestaurant.__v,
                                address: restaurant.address,
                                distance: restaurant.distance,
                            };
                        } else {
                            console.log('Excluded restaurant:', {
                                name: restaurant.name,
                                reason: !dbRestaurant ? 'Not found in DB' : 'Category mismatch',
                                category: dbRestaurant?.category,
                                requestedCategory: category
                            });
                            return null;
                        }
                    })
            );
            
            const batchResults = await Promise.all(batchPromises);
            matchedRestaurants.push(...batchResults.filter(Boolean));
        }

        console.log('Final results:', {
            totalFound: matchedRestaurants.length,
            restaurants: matchedRestaurants.map(r => r.restaurantName)
        });

        const sortedRestaurants = matchedRestaurants.sort((a, b) => a.distance - b.distance);
        return res.status(200).json({ 
            success: true, 
            data: sortedRestaurants,
            total: sortedRestaurants.length
        });

    } catch (error) {
        console.error('Error in getNearbyRestaurants:', error);
        throw error;
    } finally {
        if (isConnected) {
            await client.close().catch(console.error);
        }
    }
};

module.exports = {
    getNearbyRestaurants
};