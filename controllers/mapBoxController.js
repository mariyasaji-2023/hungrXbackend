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

// Use crypto for better UUID generation
const crypto = require('crypto');
const generateSessionToken = () => {
    return crypto.randomUUID();
};

const getBoundingBox = (lat, lon, radius) => {
    // Validate inputs
    if (!lat || !lon || !radius) {
        throw new Error('Invalid parameters for bounding box calculation');
    }
    
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
        const sessionToken = generateSessionToken();
        const bbox = getBoundingBox(latitude, longitude, radius);
        
        // Single search for restaurants/food places
        const searchTerm = 'restaurant food OR Pizza restaurant OR Fast food restaurant OR Pizza restaurant OR Cafe'; // Generic search term to get food establishments
        const searchUrl = `https://api.mapbox.com/search/v1/suggest/${encodeURIComponent(searchTerm)}`;
        
        // console.log('Making Mapbox API request with params:', {
        //     searchTerm,
        //     longitude,
        //     latitude,
        //     radius,
        //     bbox,
        //     sessionToken,
        //     url: searchUrl
        // });

        const response = await axios.get(searchUrl, {
            params: {
                access_token: process.env.MAPBOX_ACCESS_TOKEN,
                proximity: `${longitude},${latitude}`,
                types: 'poi',
                limit: 50,
                language: 'en',
                bbox: bbox,
                session_token: sessionToken
            }
        });

        if (!response.data?.suggestions) {
            // console.error('No suggestions in response', response.data);
            return [];
        }

        // console.log('Total Mapbox suggestions received:', response.data.suggestions.length);

        const restaurants = response.data.suggestions
            .filter(suggestion => {
                const keep = suggestion.feature_name && suggestion.description;
                // console.log('Filtering suggestion:', {
                //     name: suggestion.feature_name,
                //     description: suggestion.description,
                //     kept: keep,
                //     reason: !keep ? (
                //         !suggestion.feature_name ? 'Missing name' :
                //         !suggestion.description ? 'Missing description' :
                //         'Unknown'
                //     ) : 'Kept'
                // });
                return keep;
            })
            .map(suggestion => ({
                name: suggestion.feature_name,
                address: suggestion.description,
                distance: suggestion.distance || 0,
                category: suggestion.poi_category || [],
                mapboxId: suggestion.mapbox_id || '',
                context: suggestion.context || {}
            }));

        // console.log(`Found ${restaurants.length} restaurants`);
        return restaurants;

    } catch (error) {
        console.error('Error fetching restaurants:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        throw error;
    }
}

const findRestaurantInDatabase = async (restaurantName, Restaurant) => {
    if (!restaurantName || !Restaurant) {
        throw new Error('Missing required parameters');
    }

    const sanitizedName = restaurantName
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');

    // Updated chain mappings
    const chainMappings = {
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

    // Chain match
    const mappedName = chainMappings[sanitizedName];
    if (mappedName) {
        const chainMatch = await Restaurant.findOne({ restaurantName: mappedName });
        if (chainMatch) return chainMatch;
    }

    // Exact match
    let dbRestaurant = await Restaurant.findOne({
        restaurantName: { $regex: `^${sanitizedName}$`, $options: 'i' }
    });
    if (dbRestaurant) return dbRestaurant;

    // Stripped match
    const strippedName = sanitizedName.replace(/['"]/g, '').trim();
    dbRestaurant = await Restaurant.findOne({
        restaurantName: { $regex: `^${strippedName}$`, $options: 'i' }
    });
    if (dbRestaurant) return dbRestaurant;

    // Partial match
    const significantWords = sanitizedName.split(' ').filter(word => 
        word.length > 2 && 
        !['the', 'and', 'restaurant', 'cafe', 'coffee', 'shop', 'grill', 'bar', 'kitchen'].includes(word)
    );

    if (significantWords.length > 0) {
        const wordRegex = significantWords
            .map(word => `(?=.*\\b${word}\\b)`)
            .join('');

        const partialMatches = await Restaurant.find({
            restaurantName: { $regex: wordRegex, $options: 'i' }
        }).toArray();

        if (partialMatches.length === 1) return partialMatches[0];
        
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
                return closestMatch;
            }
        }
    }

    return null;
};

function levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill().map(() => 
        Array(str1.length + 1).fill(0)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1, // deletion
                matrix[j - 1][i] + 1, // insertion
                matrix[j - 1][i - 1] + substitutionCost // substitution
            );
        }
    }

    return matrix[str2.length][str1.length];
}

const getNearbyRestaurants = async (req, res) => {
    let client;
    try {
        // Input validation
        const { longitude, latitude, radius = 30000, category = 'all' } = req.query;
        
        if (!longitude || !latitude) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: longitude and latitude'
            });
        }

        // Connect to MongoDB
        client = new MongoClient(process.env.DB_URI, {
            connectTimeoutMS: 5000,
            serverSelectionTimeoutMS: 5000
        });
        
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const Restaurant = db.collection("restaurants");

        // Fetch and process restaurants
        const mapboxRestaurants = await fetchRestaurants(longitude, latitude, radius);
        
        if (!mapboxRestaurants.length) {
            return res.status(200).json({
                success: true,
                data: [],
                total: 0,
                message: 'No restaurants found in the specified area'
            });
        }

        // Process restaurants in batches
        const matchedRestaurants = [];
        const batchSize = 10;
        
        for (let i = 0; i < mapboxRestaurants.length; i += batchSize) {
            const batch = mapboxRestaurants.slice(i, i + batchSize);
            
            const batchResults = await Promise.all(
                batch.map(async restaurant => {
                    // console.log('Processing restaurant:', restaurant.name);
                    
                    const dbRestaurant = await findRestaurantInDatabase(
                        restaurant.name,
                        Restaurant
                    );

                    // console.log('Database match result:', {
                    //     searchName: restaurant.name,
                    //     found: !!dbRestaurant,
                    //     matchedName: dbRestaurant?.restaurantName,
                    //     category: dbRestaurant?.category
                    // });

                    if (!dbRestaurant || (category !== 'all' && dbRestaurant.category !== category)) {
                        // console.log('Restaurant excluded because:', {
                        //     reason: !dbRestaurant ? 'Not found in database' : 'Category mismatch',
                        //     requestedCategory: category,
                        //     restaurantCategory: dbRestaurant?.category
                        // });
                        return null;
                    }

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
                        category: dbRestaurant.category
                    };
                })
            );

            matchedRestaurants.push(...batchResults.filter(Boolean));
        }

        // Sort by distance and return results
        const uniqueRestaurants = Array.from(
            matchedRestaurants.reduce((map, restaurant) => {
                // Create a composite key using restaurant ID and address
                const locationKey = `${restaurant._id.toString()}-${restaurant.address}`;
                
                // Only add if this exact restaurant at this location isn't already in the map
                if (!map.has(locationKey)) {
                    map.set(locationKey, restaurant);
                }
                return map;
            }, new Map())
        ).map(([_, restaurant]) => restaurant);

        // Sort by distance and return results
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
        
    } finally {
        if (client) {
            await client.close().catch(console.error);
        }
    }
};

module.exports = {
    getNearbyRestaurants
};