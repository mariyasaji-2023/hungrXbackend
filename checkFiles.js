// // controllers/restaurantController.js
// const axios = require('axios');

// const VALID_CATEGORIES = {
//     "McDonald's": "McDonald's",
//     'pizza': 'pizza',
//     'Starbucks': 'Starbucks',
//     'Fast food restaurant': 'Fast food restaurant',
//     'burger': 'burger',
//     'restaurant': 'restaurant',
//     'chinese restaurant': 'chinese restaurant',
//     'japanese restaurant': 'japanese restaurant'
// };

// const fetchRestaurantsByType = async (searchTerm, longitude, latitude, radius) => {
//     try {
//         const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchTerm)}.json`;
        
//         // Simplified parameters for better results
//         const response = await axios.get(mapboxUrl, {
//             params: {
//                 access_token: process.env.MAPBOX_ACCESS_TOKEN,
//                 proximity: `${longitude},${latitude}`,
//                 limit: 10,
//                 types: 'poi,place',  // Include both POIs and places
//                 language: 'en',
//                 fuzzyMatch: true
//             }
//         });

//         if (!response.data?.features) {
//             console.log(`No features found for ${searchTerm}`);
//             return [];
//         }

//         // Map and filter results by distance
//         const results = response.data.features
//             .map(feature => {
//                 const distance = calculateDistance(
//                     latitude,
//                     longitude,
//                     feature.center[1],
//                     feature.center[0]
//                 );

//                 return {
//                     id: feature.id,
//                     name: feature.text,
//                     address: feature.place_name,
//                     coordinates: feature.center,
//                     distance: distance,
//                     category: searchTerm,
//                     properties: feature.properties || {}
//                 };
//             })
//             .filter(place => place.distance <= radius);

//         console.log(`Found ${results.length} results for ${searchTerm} within ${radius}m`);
//         return results;

//     } catch (error) {
//         console.error(`Error fetching ${searchTerm}:`, error.message);
//         return [];
//     }
// };

// const calculateDistance = (lat1, lon1, lat2, lon2) => {
//     const R = 6371; // Earth's radius in km
//     const dLat = toRad(lat2 - lat1);
//     const dLon = toRad(lon2 - lon1);
    
//     const a = 
//         Math.sin(dLat/2) * Math.sin(dLat/2) +
//         Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
//         Math.sin(dLon/2) * Math.sin(dLon/2);
    
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//     return Math.round(R * c * 1000); // Convert to meters and round
// };

// const toRad = (value) => value * Math.PI / 180;

// const getNearbyRestaurants = async (req, res) => {
//     try {
//         let { 
//             longitude, 
//             latitude, 
//             radius = 5000, // Increased default radius to 5km for better results
//             category = 'all'
//         } = req.query;

//         // Validate required parameters
//         if (!longitude || !latitude) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Longitude and latitude are required'
//             });
//         }

//         // Convert string parameters to numbers
//         const numLongitude = parseFloat(longitude);
//         const numLatitude = parseFloat(latitude);
//         const numRadius = parseInt(radius);

//         // Validate numeric values
//         if (isNaN(numLongitude) || isNaN(numLatitude) || isNaN(numRadius)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid numeric parameters'
//             });
//         }

//         // Add debug logging
//         console.log(`Searching for restaurants near ${numLatitude}, ${numLongitude} within ${numRadius}m`);

//         if (category === 'all') {
//             const results = await Promise.all(
//                 Object.keys(VALID_CATEGORIES).map(type =>
//                     fetchRestaurantsByType(type, numLongitude, numLatitude, numRadius)
//                 )
//             );

//             const uniqueRestaurants = new Map();

//             results.flat().forEach(restaurant => {
//                 if (!uniqueRestaurants.has(restaurant.id)) {
//                     uniqueRestaurants.set(restaurant.id, restaurant);
//                 }
//             });

//             const allRestaurants = Array.from(uniqueRestaurants.values())
//                 .sort((a, b) => a.distance - b.distance);

//             console.log(`Found ${allRestaurants.length} total unique restaurants`);

//             return res.status(200).json({
//                 success: true,
//                 data: allRestaurants
//             });
//         }

//         if (!VALID_CATEGORIES[category]) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid category. Valid categories are: ' + Object.keys(VALID_CATEGORIES).join(', ')
//             });
//         }

//         const restaurants = await fetchRestaurantsByType(
//             VALID_CATEGORIES[category],
//             numLongitude,
//             numLatitude,
//             numRadius
//         );

//         return res.status(200).json({
//             success: true,
//             data: restaurants
//         });

//     } catch (error) {
//         console.error('Error fetching nearby restaurants:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Error fetching nearby restaurants',
//             error: error.message
//         });
//     }
// };

// module.exports = {
//     getNearbyRestaurants
// };



// controllers/restaurantController.js
const axios = require('axios');
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DB_URI);

const VALID_CATEGORIES = {
    "McDonald's": "McDonald's",
    'pizza': 'pizza',
    'Starbucks': 'Starbucks',
    'Fast food restaurant': 'Fast food restaurant',
    'burger': 'burger',
    'restaurant': 'restaurant'
};

// Helper function to check if restaurant exists in database
const checkRestaurantInDatabase = async (restaurantData) => {
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const Restaurant = db.collection("restaurants");
        
        // Simple name-based search without geospatial query
        const exists = await Restaurant.findOne({
            name: { $regex: new RegExp(restaurantData.name, 'i') }, // Case-insensitive name match
        });
        
        return !!exists;
    } catch (error) {
        console.error('Error checking restaurant in database:', error);
        return false;
    }
};

const getNearbyRestaurants = async (req, res) => {
    try {
        const {
            longitude,
            latitude,
            radius = 1000,
            category = 'all'
        } = req.query;

        if (!longitude || !latitude) {
            return res.status(400).json({
                success: false,
                message: 'Longitude and latitude are required'
            });
        }

        if (category === 'all') {
            const results = await Promise.all([
                fetchRestaurantsByType("McDonald's", longitude, latitude, radius),
                fetchRestaurantsByType('pizza', longitude, latitude, radius),
                fetchRestaurantsByType('Starbucks', longitude, latitude, radius),
                fetchRestaurantsByType('Fast food restaurant', longitude, latitude, radius),
                fetchRestaurantsByType('burger', longitude, latitude, radius),
                fetchRestaurantsByType('restaurant', longitude, latitude, radius),
                fetchRestaurantsByType('chinese restaurant', longitude, latitude, radius),
                fetchRestaurantsByType('japanese restaurant', longitude, latitude, radius)
            ]);

            const uniqueRestaurants = new Map();
            
            // Process restaurants in batches
            const batchSize = 10;
            const flatResults = results.flat();
            
            for (let i = 0; i < flatResults.length; i += batchSize) {
                const batch = flatResults.slice(i, i + batchSize);
                const checkResults = await Promise.all(
                    batch.map(async restaurant => {
                        if (!uniqueRestaurants.has(restaurant.id)) {
                            const exists = await checkRestaurantInDatabase(restaurant);
                            return { restaurant, exists };
                        }
                        return { restaurant, exists: false };
                    })
                );
                
                for (const { restaurant, exists } of checkResults) {
                    if (exists && !uniqueRestaurants.has(restaurant.id)) {
                        const propertyCategory = (restaurant.properties.category || '').toLowerCase();
                        let assignedCategory = 'restaurant';

                        if (propertyCategory.includes('cafe')) {
                            assignedCategory = 'cafe';
                        } else if (propertyCategory.includes('pizza')) {
                            assignedCategory = 'pizza';
                        } else if (propertyCategory.includes('indian')) {
                            assignedCategory = 'indian restaurant';
                        } else if (propertyCategory.includes('chinese')) {
                            assignedCategory = 'chinese restaurant';
                        } else if (propertyCategory.includes('japanese')) {
                            assignedCategory = 'japanese restaurant';
                        } else if (propertyCategory.includes('fast food')) {
                            assignedCategory = 'Fast food restaurant';
                        }

                        uniqueRestaurants.set(restaurant.id, {
                            ...restaurant,
                            category: assignedCategory
                        });
                    }
                }
            }

            const allRestaurants = Array.from(uniqueRestaurants.values())
                .filter(restaurant => restaurant.distance <= radius)
                .sort((a, b) => a.distance - b.distance);

            return res.status(200).json({
                success: true,
                data: allRestaurants
            });
        }

        if (!VALID_CATEGORIES[category]) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category. Valid categories are: ' + Object.keys(VALID_CATEGORIES).join(', ')
            });
        }

        const restaurants = await fetchRestaurantsByType(
            VALID_CATEGORIES[category],
            longitude,
            latitude,
            radius
        );

        const filteredRestaurants = [];
        const batchSize = 10;
        
        for (let i = 0; i < restaurants.length; i += batchSize) {
            const batch = restaurants.slice(i, i + batchSize);
            const checkResults = await Promise.all(
                batch.map(async restaurant => {
                    const exists = await checkRestaurantInDatabase(restaurant);
                    return { restaurant, exists };
                })
            );
            
            for (const { restaurant, exists } of checkResults) {
                if (exists && restaurant.distance <= radius) {
                    filteredRestaurants.push(restaurant);
                }
            }
        }

        filteredRestaurants.sort((a, b) => a.distance - b.distance);

        return res.status(200).json({
            success: true,
            data: filteredRestaurants
        });

    } catch (error) {
        console.error('Error fetching nearby restaurants:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching nearby restaurants',
            error: error.message
        });
    } finally {
        try {
            await client.close();
        } catch (error) {
            console.error('Error closing MongoDB connection:', error);
        }
    }
};

const fetchRestaurantsByType = async (searchTerm, longitude, latitude, radius) => {
    try {
        const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchTerm)}.json`;

        const response = await axios.get(mapboxUrl, {
            params: {
                access_token: process.env.MAPBOX_ACCESS_TOKEN,
                proximity: `${longitude},${latitude}`
            }
        });

        if (!response.data?.features) {
            return [];
        }

        const answer = response.data.features.map(feature => ({
            id: feature.id,
            name: feature.text,
            address: feature.place_name,
            coordinates: feature.center,
            distance: calculateDistance(
                latitude,
                longitude,
                feature.center[1],
                feature.center[0]
            ),
            category: searchTerm,
            properties: feature.properties || {}
        }));

        return answer;
    } catch (error) {
        console.error(`Error fetching ${searchTerm}:`, error);
        return [];
    }
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 1000); // Convert to meters and round
};

const toRad = (value) => value * Math.PI / 180;

module.exports = {
    getNearbyRestaurants
};