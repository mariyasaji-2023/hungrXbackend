const axios = require('axios');
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DB_URI);

// Updated DEFAULT_CATEGORIES to include new categories
const DEFAULT_CATEGORIES = {
    'fast-food': 'Fast food restaurant',
    'pizza': 'Pizza restaurant',
    'burger': 'Burger restaurant',
    'coffee': 'Coffee shop',
    'restaurant': 'Restaurant',
    'cafe': 'Cafe',
    'ice-cream': 'Ice cream shop',
    'Taco Bell': 'Taco Bell',
    'Chipotle': 'Chipotle',
    "Wendys": "Wendys",
    "McDonald's": "McDonald's",
    "Popeyes": "Popeyes",
    "Dominos": "Dominos",
    "Pizza Hut": "Pizza Hut",
    "Panera Bread": "Panera Bread",
    "Dunkin": "Dunkin"
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
        
        let allRestaurants = [];
        const sessionToken = generateSessionToken();
        const bbox = getBoundingBox(latitude, longitude, radius);

        // Make parallel requests for each search term
        const searchPromises = searchTerms.map(async (term) => {
            const searchUrl = `https://api.mapbox.com/search/v1/suggest/${encodeURIComponent(searchTerm)}`;
            
            console.log('Making Mapbox API request with params:', {
                term,
                longitude,
                latitude,
                radius,
                bbox,
                sessionToken,
                url: searchUrl
            });

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
                console.error(`No suggestions in response for term: ${term}`, response.data);
                return [];
            }

            console.log(`Total Mapbox suggestions received for ${term}:`, response.data.suggestions.length);

            return response.data.suggestions
                .filter(suggestion => {
                    const keep = suggestion.feature_name && suggestion.description;
                    console.log('Filtering suggestion:', {
                        term,
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
                .map(suggestion => ({
                    name: suggestion.feature_name,
                    address: suggestion.description,
                    distance: suggestion.distance || 0,
                    category: suggestion.poi_category || [],
                    mapboxId: suggestion.mapbox_id || '',
                    context: suggestion.context || {},
                    searchTerm: term // Add the search term to track which query found this result
                }));
        });

        // Wait for all searches to complete
        const results = await Promise.all(searchPromises);
        
        // Combine and deduplicate results based on mapboxId
        allRestaurants = Array.from(
            results.flat().reduce((map, restaurant) => {
                if (!map.has(restaurant.mapboxId)) {
                    map.set(restaurant.mapboxId, restaurant);
                }
                return map;
            }, new Map())
        ).map(([_, restaurant]) => restaurant);

        console.log(`Found ${allRestaurants.length} unique restaurants after combining all search terms`);
        return allRestaurants;

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
    // Step 1: Initial sanitization - keep more special characters for better matching
    const sanitizedName = restaurantName
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');

    console.log('Looking for restaurant:', {
        original: restaurantName,
        sanitized: sanitizedName
    });

    // Step 2: Chain name mappings (expanded with more variations)
    const chainMappings = {
        'mcdonalds': 'McDonald\'s',
        'mcdonald\'s': 'McDonald\'s',
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
        "Pizza Hut":"Pizza Hut",
        "Panera Bread":"Panera Bread"
    };

    // Check for chain matches first
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

    // Step 4: Try matching with minimal character stripping
    const minimallyStrippedName = sanitizedName
        .replace(/['"]/g, '') // Only remove quotes
        .trim();

    dbRestaurant = await Restaurant.findOne({
        restaurantName: {
            $regex: `^${minimallyStrippedName}$`,
            $options: 'i'
        }
    });

    if (dbRestaurant) {
        console.log('Found stripped match:', dbRestaurant.restaurantName);
        return dbRestaurant;
    }

    // Step 5: Try a more strict partial match
    const words = sanitizedName.split(' ').filter(word => 
        word.length > 2 && 
        !['the', 'and', 'restaurant', 'cafe', 'coffee', 'shop', 'grill', 'bar', 'kitchen'].includes(word)
    );

    if (words.length > 0) {
        // Create a regex that requires all significant words to be present in order
        const wordRegex = words
            .map(word => `(?=.*\\b${word}\\b)`) // Require word boundaries
            .join('');

        const partialMatches = await Restaurant.find({
            restaurantName: {
                $regex: wordRegex,
                $options: 'i'
            }
        }).toArray();

        if (partialMatches.length === 1) {
            // Only return a partial match if it's unique
            console.log('Found unique partial match:', partialMatches[0].restaurantName);
            return partialMatches[0];
        } else if (partialMatches.length > 1) {
            // If multiple matches, use Levenshtein distance to find the closest match
            const closestMatch = partialMatches.reduce((closest, current) => {
                const currentDist = levenshteinDistance(current.restaurantName.toLowerCase(), sanitizedName);
                const closestDist = levenshteinDistance(closest.restaurantName.toLowerCase(), sanitizedName);
                return currentDist < closestDist ? current : closest;
            });

            // Only return if the Levenshtein distance is below a threshold
            const distance = levenshteinDistance(closestMatch.restaurantName.toLowerCase(), sanitizedName);
            if (distance <= Math.min(5, sanitizedName.length * 0.3)) {
                console.log('Found closest partial match:', closestMatch.restaurantName);
                return closestMatch;
            }
        }
    }

    console.log('No match found for:', restaurantName);
    return null;
};

// Helper function to calculate Levenshtein distance
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],     // deletion
                    dp[i][j - 1],     // insertion
                    dp[i - 1][j - 1]  // substitution
                );
            }
        }
    }

    return dp[m][n];
}

const getNearbyRestaurants = async (req, res) => {
    let isConnected = false;
    try {
        console.log('Attempting to connect to MongoDB...');
        await client.connect();
        isConnected = true;
        console.log('Successfully connected to MongoDB');
        
        const db = client.db(process.env.DB_NAME);
        const Restaurant = db.collection("restaurants");
        
        // Verify DB connection
        const dbStats = await db.stats();
        console.log('Database stats:', dbStats);
        
        const { longitude, latitude, radius = 30000, category = 'all' } = req.query;

        console.log('Starting search with params:', { 
            longitude, 
            latitude, 
            radius, 
            category,
            dbName: process.env.DB_NAME,
            collectionName: "restaurants"
        });

        // Verify collection exists and has documents
        const count = await Restaurant.countDocuments();
        console.log(`Restaurant collection has ${count} documents`);

        const mapboxRestaurants = await fetchRestaurants(longitude, latitude, radius);
        console.log(`Retrieved ${mapboxRestaurants.length} restaurants from Mapbox`);

        if (mapboxRestaurants.length === 0) {
            console.log('No restaurants found from Mapbox API');
            return res.status(200).json({ 
                success: true, 
                data: [],
                total: 0,
                message: 'No restaurants found in the specified area'
            });
        }

        const matchedRestaurants = [];
        const batchSize = 10;
        
        for (let i = 0; i < mapboxRestaurants.length; i += batchSize) {
            const batch = mapboxRestaurants.slice(i, i + batchSize);
            console.log(`Processing batch ${i/batchSize + 1} of ${Math.ceil(mapboxRestaurants.length/batchSize)}`);
            console.log('Current batch restaurants:', batch.map(r => r.name));
            
            const batchPromises = batch.map(restaurant => 
                findRestaurantInDatabase(restaurant.name, Restaurant)
                    .then(dbRestaurant => {
                        if (dbRestaurant && (category === 'all' || dbRestaurant.category === category)) {
                            console.log('Successfully matched and included:', {
                                mapboxName: restaurant.name,
                                dbName: dbRestaurant.restaurantName,
                                category: dbRestaurant.category
                            });
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
            restaurants: matchedRestaurants.map(r => ({
                name: r.restaurantName,
                category: r.category,
                distance: r.distance
            }))
        });

        const sortedRestaurants = matchedRestaurants.sort((a, b) => a.distance - b.distance);
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
            error: error.message
        });
    } finally {
        if (isConnected) {
            await client.close().catch(console.error);
        }
    }
};
module.exports = {
    getNearbyRestaurants
};