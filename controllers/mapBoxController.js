const axios = require('axios');
const { MongoClient } = require('mongodb');

// Move configuration to environment variables or config file
const DEFAULT_CATEGORIES = {
    'fast-food': 'Fast food restaurant',
    'pizza': 'Pizza restaurant',
    'burger': 'Burger restaurant',
    'coffee': 'Coffee shop',
    'restaurant': 'Restaurant',
    'cafe': 'Cafe',
    'ice-cream': 'Ice cream shop',
    'Taco Bell': 'Taco Bell',
    'Chipotle': 'Chipotle Mexican Grill',
    "Wendys": "Wendys",
    "McDonald's": "McDonald's",
    "Popeyes": "Popeyes",
    "Dominos": "Dominos",
    "Pizza Hut": "Pizza Hut",
    "Panera Bread": "Panera Bread",
    "Dunkin": "Dunkin"
};

// Chain mappings cache to avoid recomputing
const CHAIN_MAPPINGS = {
    'mcdonalds': "McDonald's",
    'mcdonald\'s': "McDonald's",
    'chipotle mexican grill': 'Chipotle Mexican Grill',
    'chipotle': 'Chipotle Mexican Grill',
    'starbucks coffee': 'Starbucks',
    'starbucks': 'Starbucks',
    'wendys': 'Wendys',
    'wendy\'s': 'Wendys',
    'dominos': 'Dominos',
    'domino\'s': 'Dominos',
    'popeyes': 'Popeyes',
    'popeye\'s': 'Popeyes',
    'taco bell': 'Taco Bell',
    'pizza hut': 'Pizza Hut',
    'panera bread': 'Panera Bread',
    'dunkin': 'Dunkin',
    'dunkin donuts': 'Dunkin'
};

// Stopwords for query optimization
const STOPWORDS = new Set(['the', 'and', 'restaurant', 'cafe', 'coffee', 'shop', 'grill', 'bar', 'kitchen']);

// Use crypto for better UUID generation
const crypto = require('crypto');
const generateSessionToken = () => {
    return crypto.randomUUID();
};

// Pre-compile regex for better performance
const HTTP_REGEX = /^https?:\/\//;

// Create a MongoDB client connection pool - reuse across requests
let clientPromise = null;
const getMongoClient = async () => {
    if (!clientPromise) {
        const client = new MongoClient(process.env.DB_URI, {
            // Increased max pool size for better concurrency
            maxPoolSize: 20,
            minPoolSize: 5,
            connectTimeoutMS: 5000,
            serverSelectionTimeoutMS: 5000
        });
        
        clientPromise = client.connect();
    }
    
    return clientPromise;
};

const getBoundingBox = (lat, lon, radius) => {
    // Validate inputs
    if (!lat || !lon || !radius) {
        throw new Error('Invalid parameters for bounding box calculation');
    }
    
    // Convert inputs to numbers once
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const radiusNum = Number(radius);
    
    const radDeg = (radiusNum / 1000) / 111.32;
    
    const minLon = lonNum - radDeg / Math.cos(latNum * Math.PI / 180);
    const maxLon = lonNum + radDeg / Math.cos(latNum * Math.PI / 180);
    const minLat = latNum - radDeg;
    const maxLat = latNum + radDeg;

    return [
        minLon.toFixed(6),
        minLat.toFixed(6),
        maxLon.toFixed(6),
        maxLat.toFixed(6)
    ].join(',');
};

const fetchRestaurants = async (longitude, latitude, radius) => {
    try {
        const sessionToken = generateSessionToken();
        const bbox = getBoundingBox(latitude, longitude, radius);
        
        // Use Axios timeout to avoid hanging requests
        const searchTerm = 'restaurant food OR Pizza restaurant OR Fast food restaurant OR Cafe OR Coffee shop';
        const searchUrl = `https://api.mapbox.com/search/v1/suggest/${encodeURIComponent(searchTerm)}`;
        
        const response = await axios.get(searchUrl, {
            params: {
                access_token: process.env.MAPBOX_ACCESS_TOKEN,
                proximity: `${longitude},${latitude}`,
                types: 'poi',
                limit: 100,
                language: 'en',
                bbox: bbox,
                session_token: sessionToken
            },
            // Add timeout to prevent long-running requests
            timeout: 5000
        });

        if (!response.data?.suggestions) {
            return [];
        }

        // Use faster map/filter patterns
        return response.data.suggestions
            .filter(suggestion => suggestion.feature_name && suggestion.description)
            .map(suggestion => ({
                name: suggestion.feature_name,
                address: suggestion.description,
                distance: suggestion.distance || 0,
                category: suggestion.poi_category || [],
                mapboxId: suggestion.mapbox_id || '',
                context: suggestion.context || {}
            }));

    } catch (error) {
        console.error('Error fetching restaurants:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        throw error;
    }
};

// Optimized version with memoization for frequently accessed restaurants
const memoizedRestaurants = new Map();

const findRestaurantInDatabase = async (restaurantName, Restaurant) => {
    if (!restaurantName || !Restaurant) {
        throw new Error('Missing required parameters');
    }

    // Check memo cache first
    const memoKey = restaurantName.trim().toLowerCase();
    if (memoizedRestaurants.has(memoKey)) {
        return memoizedRestaurants.get(memoKey);
    }

    const sanitizedName = restaurantName
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');

    // Chain match - direct lookup is faster than DB query
    const mappedName = CHAIN_MAPPINGS[sanitizedName];
    if (mappedName) {
        const chainMatch = await Restaurant.findOne({ restaurantName: mappedName });
        if (chainMatch) {
            // Cache the result
            memoizedRestaurants.set(memoKey, chainMatch);
            return chainMatch;
        }
    }

    // Exact match
    let dbRestaurant = await Restaurant.findOne({
        restaurantName: { $regex: `^${sanitizedName}$`, $options: 'i' }
    });
    if (dbRestaurant) {
        memoizedRestaurants.set(memoKey, dbRestaurant);
        return dbRestaurant;
    }

    // Stripped match
    const strippedName = sanitizedName.replace(/['"]/g, '').trim();
    dbRestaurant = await Restaurant.findOne({
        restaurantName: { $regex: `^${strippedName}$`, $options: 'i' }
    });
    if (dbRestaurant) {
        memoizedRestaurants.set(memoKey, dbRestaurant);
        return dbRestaurant;
    }

    // Partial match - optimized to reduce unnecessary DB calls
    const significantWords = sanitizedName.split(' ').filter(word => 
        word.length > 2 && !STOPWORDS.has(word)
    );

    if (significantWords.length > 0) {
        // Use simple query conditions to avoid regex errors
        const conditions = significantWords.map(word => {
            // Escape special regex characters in the word
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return { restaurantName: { $regex: escapedWord, $options: 'i' } };
        });

        const partialMatches = await Restaurant.find({ $and: conditions })
            .limit(10) // Limit to improve performance
            .toArray();

        if (partialMatches.length === 1) {
            memoizedRestaurants.set(memoKey, partialMatches[0]);
            return partialMatches[0];
        }
        
        if (partialMatches.length > 0) {
            const closestMatch = partialMatches.reduce((closest, current) => {
                const currentDist = levenshteinDistance(
                    current.restaurantName.toLowerCase(),
                    sanitizedName
                );
                const closestDist = levenshteinDistance(
                    closest.restaurantName.toLowerCase(),
                    sanitizedName
                );
                return currentDist < closestDist ? current : closest;
            });

            const distance = levenshteinDistance(
                closestMatch.restaurantName.toLowerCase(),
                sanitizedName
            );
            
            if (distance <= Math.min(5, sanitizedName.length * 0.3)) {
                memoizedRestaurants.set(memoKey, closestMatch);
                return closestMatch;
            }
        }
    }

    // Cache negative lookups too
    memoizedRestaurants.set(memoKey, null);
    return null;
};

// Optimized Levenshtein distance calculation
function levenshteinDistance(str1, str2) {
    // Early returns for common cases
    if (str1 === str2) return 0;
    if (!str1.length) return str2.length;
    if (!str2.length) return str1.length;
    
    // Use smaller arrays for memory efficiency
    const len1 = str1.length;
    const len2 = str2.length;
    
    let prevRow = Array(len1 + 1).fill(0);
    let currRow = Array(len1 + 1).fill(0);
    
    // Initialize the previous row
    for (let i = 0; i <= len1; i++) {
        prevRow[i] = i;
    }
    
    // Fill in the rest of the matrix
    for (let j = 1; j <= len2; j++) {
        currRow[0] = j;
        
        for (let i = 1; i <= len1; i++) {
            const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            currRow[i] = Math.min(
                currRow[i - 1] + 1, // deletion
                prevRow[i] + 1, // insertion
                prevRow[i - 1] + substitutionCost // substitution
            );
        }
        
        // Swap rows
        [prevRow, currRow] = [currRow, prevRow];
    }
    
    return prevRow[len1];
}

const getNearbyRestaurants = async (req, res) => {
    let client;
    try {
        // Input validation with default values
        const longitude = req.query.longitude;
        const latitude = req.query.latitude;
        const radius = Number(req.query.radius) || 30000;
        const category = req.query.category || 'all';
        
        if (!longitude || !latitude) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: longitude and latitude'
            });
        }

        // Get client from connection pool
        client = await getMongoClient();
        const db = client.db(process.env.DB_NAME);
        const Restaurant = db.collection("restaurants");

        // Start fetching restaurants early
        const mapboxRestaurantsPromise = fetchRestaurants(longitude, latitude, radius);
        
        // Create index if it doesn't exist (should be done during deployment)
        try {
            await Restaurant.createIndex({ restaurantName: 1 });
        } catch (indexError) {
            console.error('Warning: Could not create index:', indexError.message);
            // Continue without failing - index might already exist
        }
        
        // Wait for restaurant data
        const mapboxRestaurants = await mapboxRestaurantsPromise;
        
        if (!mapboxRestaurants.length) {
            return res.status(200).json({
                success: true,
                data: [],
                total: 0,
                message: 'No restaurants found in the specified area'
            });
        }

        // Increase batch size for fewer DB round trips
        const matchedRestaurants = [];
        const batchSize = 20; // Increased from 10
        
        for (let i = 0; i < mapboxRestaurants.length; i += batchSize) {
            const batch = mapboxRestaurants.slice(i, i + batchSize);
            
            const batchResults = await Promise.all(
                batch.map(async restaurant => {
                    try {
                        const dbRestaurant = await findRestaurantInDatabase(
                            restaurant.name,
                            Restaurant
                        );

                        if (!dbRestaurant || (category !== 'all' && dbRestaurant.category !== category)) {
                            return null;
                        }

                        // Check logo validity once using regex
                        const hasValidLogo = dbRestaurant.logo && HTTP_REGEX.test(dbRestaurant.logo);
                        
                        if (!hasValidLogo) {
                            return null; // Filter out invalid logos early
                        }

                        return {
                            _id: dbRestaurant._id,
                            restaurantName: dbRestaurant.restaurantName,
                            logo: dbRestaurant.logo,
                            createdAt: dbRestaurant.createdAt,
                            updatedAt: dbRestaurant.updatedAt,
                            __v: dbRestaurant.__v,
                            address: restaurant.address,
                            distance: restaurant.distance,
                            category: dbRestaurant.category
                        };
                    } catch (err) {
                        console.error(`Error processing restaurant ${restaurant.name}:`, err.message);
                        return null;
                    }
                })
            );

            matchedRestaurants.push(...batchResults.filter(Boolean));
        }

        // Use Map for faster uniqueness check with O(1) lookups instead of O(n)
        const uniqueMap = new Map();
        for (const restaurant of matchedRestaurants) {
            const locationKey = `${restaurant._id.toString()}-${restaurant.address}`;
            if (!uniqueMap.has(locationKey)) {
                uniqueMap.set(locationKey, restaurant);
            }
        }
        
        // Convert to array and sort
        const uniqueRestaurants = Array.from(uniqueMap.values());
        const sortedRestaurants = uniqueRestaurants.sort((a, b) => a.distance - b.distance);
        
        return res.status(200).json({
            success: true,
            data: sortedRestaurants,
            total: sortedRestaurants.length
        });

    } catch (error) {
        console.error('Error in getNearbyRestaurants:', {
            message: error.message,
            stack: error.stack
        });
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
        
    }
    // Don't close the connection to allow connection pooling
};

const suggestions = async (req, res) => {
    try {
        // Get client from connection pool
        const client = await getMongoClient();
        const db = client.db(process.env.DB_NAME);
        const Restaurant = db.collection("restaurants");
        
        // Use a safer approach for finding restaurants with valid logos
        const restaurants = await Restaurant.find({
            logo: { $regex: "^http(s)?://", $options: "i" }
        }).project({
            restaurantName: 1,
            address: 1,
            coordinates: 1,
            distance: 1,
            _id: 1,
            logo: 1
        }).limit(100).toArray();

        // Format the results
        const formattedRestaurants = restaurants.map(restaurant => ({
            name: restaurant.restaurantName || null,
            address: restaurant.address || null,
            coordinates: restaurant.coordinates || null,
            distance: restaurant.distance || null,
            _id: restaurant._id || null,
            logo: restaurant.logo || null
        }));
        
        return res.status(200).json({
            status: true,
            restaurants: formattedRestaurants
        });
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
    // Don't close the connection to allow connection pooling
};

const clearMemoizationCache = () => {
    memoizedRestaurants.clear();
};

// Set up a timer to clear the cache every hour
setInterval(clearMemoizationCache, 60 * 60 * 1000);

module.exports = {
    getNearbyRestaurants,
    suggestions, 
    clearMemoizationCache // Export for testing/manual clearing
};