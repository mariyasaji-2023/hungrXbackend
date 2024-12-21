// // controllers/restaurantController.js
// const axios = require('axios');

// const VALID_CATEGORIES = {
//     "McDonald's": "McDonald's",
//     'pizza': 'pizza',
//     'Starbucks': 'Starbucks',
//     'Fast food restaurant': 'Fast food restaurant',
//     'burger': 'burger',
//     'restaurant': 'restaurant'
// };

// const getNearbyRestaurants = async (req, res) => {
//     try {
//         const { 
//             longitude, 
//             latitude, 
//             radius = 1000,
//             category = 'all'
//         } = req.query;

//         if (!longitude || !latitude) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Longitude and latitude are required'
//             });
//         }

//         // Convert string parameters to numbers
//         // const numLongitude = parseFloat(longitude);
//         // const numLatitude = parseFloat(latitude);
//         // const numRadius = parseInt(radius);

//         if (category === 'all') {
//             const results = await Promise.all([
//                 fetchRestaurantsByType("McDonald's", longitude, latitude, radius),
//                 fetchRestaurantsByType('pizza', longitude, latitude, radius),
//                 fetchRestaurantsByType('Starbucks', longitude, latitude, radius),
//                 fetchRestaurantsByType('Fast food restaurant', longitude, latitude, radius),
//                 fetchRestaurantsByType('burger', longitude, latitude, radius),
//                 fetchRestaurantsByType('restaurant', longitude, latitude, radius),
//                 fetchRestaurantsByType('chinese restaurant', longitude, latitude, radius),
//                 fetchRestaurantsByType('japanese restaurant', longitude, latitude, radius)
//             ]);
//    console.log(results,"res");
   
//             // Use a Map to deduplicate by restaurant ID
//             const uniqueRestaurants = new Map();

//             results.flat().forEach(restaurant => {
//                 if (!uniqueRestaurants.has(restaurant.id)) {
//                     const propertyCategory = (restaurant.properties.category || '').toLowerCase();
//                     let assignedCategory = 'restaurant';

//                     if (propertyCategory.includes('cafe')) {
//                         assignedCategory = 'cafe';
//                     } else if (propertyCategory.includes('pizza')) {
//                         assignedCategory = 'pizza';
//                     } else if (propertyCategory.includes('indian')) {
//                         assignedCategory = 'indian restaurant';
//                     } else if (propertyCategory.includes('chinese')) {
//                         assignedCategory = 'chinese restaurant';
//                     } else if (propertyCategory.includes('japanese')) {
//                         assignedCategory = 'japanese restaurant';
//                     } else if (propertyCategory.includes('fast food')) {
//                         assignedCategory = 'Fast food restaurant';
//                     }

//                     uniqueRestaurants.set(restaurant.id, {
//                         ...restaurant,
//                         category: assignedCategory
//                     });
//                 }
//             });
// console.log(uniqueRestaurants,"uuuuuuuuuuuuuuuuuuuuuuuuuu");
// console.log(radius, "Radius Value");
// uniqueRestaurants.forEach(restaurant => console.log(restaurant.distance, "Restaurant Distance"))


//             // Convert Map to array, ensure all restaurants are within radius, and sort by distance
//             const allRestaurants = Array.from(uniqueRestaurants.values())
//                 .filter(restaurant => restaurant.distance <= radius)
//                 .sort((a, b) => a.distance - b.distance);
//          console.log(allRestaurants,"///////////////////////");
         
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
//             longitude,
//             latitude,
//             radius
//         );

//         // Ensure restaurants are within radius and sorted by distance
//         const filteredRestaurants = restaurants
//             .filter(restaurant => restaurant.distance <= radius)
//             .sort((a, b) => a.distance - b.distance);

//         return res.status(200).json({
//             success: true,
//             data: filteredRestaurants
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


// const fetchRestaurantsByType = async (searchTerm, longitude, latitude, radius) => {
//     try {
//         const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchTerm)}.json`;
        
//         const response = await axios.get(mapboxUrl, {
//             params: {
//                 access_token: process.env.MAPBOX_ACCESS_TOKEN,
//                 proximity: `${longitude},${latitude}`
//             }
//         });

//         if (!response.data?.features) {
//             return [];
//         }

//         // Filter results by distance before returning
//         const answer =  response.data.features.map(feature => ({
//                          id: feature.id,
//                          name: feature.text,
//                          address: feature.place_name,
//                          coordinates: feature.center,
//                          distance: calculateDistance(
//                              latitude,
//                              longitude,
//                             feature.center[1],
//                             feature.center[0]
//                          ),
//                          category: searchTerm,
//                        properties: feature.properties || {}
//                      }));
// console.log(answer,"answer");

//             return answer;
//     } catch (error) {
//         console.error(`Error fetching ${searchTerm}:`, error.message);
//         return [];
//     }
// };

// const calculateDistance = (lat1, lon1, lat2, lon2) => {
//     const R = 6371;
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

// module.exports = {
//     getNearbyRestaurants
// };


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



// // controllers/restaurantController.js
// const axios = require('axios');
// const { MongoClient } = require('mongodb');
// const client = new MongoClient(process.env.DB_URI);

// const VALID_CATEGORIES = {
//     "McDonald's": "McDonald's",
//     'pizza': 'pizza',
//     'Starbucks': 'Starbucks',
//     'Fast food restaurant': 'Fast food restaurant',
//     'burger': 'burger',
//     'restaurant': 'restaurant'
// };

// // Helper function to check if restaurant exists in database
// const checkRestaurantInDatabase = async (restaurantData) => {
//     try {
//         await client.connect();
//         const db = client.db(process.env.DB_NAME);
//         const Restaurant = db.collection("restaurants");

//         const sanitizedName = restaurantData.name.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '');
//         const exists = await Restaurant.findOne({
//             restaurantName: {
//                 $regex: sanitizedName,
//                 $options: 'i',
//             },
//         });
// // console.log(exists,">>>>>>>>>>>>>>>>>>>>>>>>>>>>");

//         return !!exists;
//     } catch (error) {
//         console.error('Error checking restaurant in database:', error);
//         return false;
//     }
// };

// //Chick-fil-A
// const getNearbyRestaurants = async (req, res) => {
//     try {
//         const { longitude, latitude, radius = 1000, category = 'all' } = req.query;

//         if (!longitude || !latitude) {
//             return res.status(400).json({ success: false, message: 'Longitude and latitude are required' });
//         }

//         const uniqueRestaurants = new Map();

//         if (category === 'all') {
//             const results = await Promise.all([
//                 fetchRestaurantsByType("McDonald's", longitude, latitude, radius),
//                 fetchRestaurantsByType('pizza', longitude, latitude, radius),
//                 fetchRestaurantsByType('Starbucks', longitude, latitude, radius),
//                 fetchRestaurantsByType('Fast food restaurant', longitude, latitude, radius),
//                 fetchRestaurantsByType('burger', longitude, latitude, radius),
//                 fetchRestaurantsByType('restaurant', longitude, latitude, radius),
//                 fetchRestaurantsByType('chinese restaurant', longitude, latitude, radius),
//                 fetchRestaurantsByType('japanese restaurant', longitude, latitude, radius),
//             ]);

//             const flatResults = results.flat();
//             const batchSize = 10;

//             for (let i = 0; i < flatResults.length; i += batchSize) {
//                 const batch = flatResults.slice(i, i + batchSize);

//                 const checkResults = await Promise.all(
//                     batch.map(async (restaurant) => {
//                         const exists = await checkRestaurantInDatabase(restaurant);
//                         return { restaurant, exists };
//                     })
//                 );


//                 for (const { restaurant, exists } of checkResults) {
//                     if (exists && !uniqueRestaurants.has(restaurant.name)) {
//                         const category = restaurant.properties.category?.toLowerCase() || 'restaurant';
//                         uniqueRestaurants.set(restaurant.name, {
//                             ...restaurant,
//                             category,
//                         });
//                     }
//                 }
//             }
           
//             const allRestaurants = Array.from(uniqueRestaurants.values())
//                 .filter((restaurant) => restaurant.distance <= radius)
//                 .sort((a, b) => a.distance - b.distance);
//                 console.log(allRestaurants,"cccccccccccccccccccccccccccccc");
//             return res.status(200).json({ success: true, data: allRestaurants });
//         }

//         if (!VALID_CATEGORIES[category]) {
//             return res.status(400).json({ success: false, message: `Invalid category: ${category}` });
//         }

//         const restaurants = await fetchRestaurantsByType(VALID_CATEGORIES[category], longitude, latitude, radius);

//         const filteredRestaurants = [];
//         for (let i = 0; i < restaurants.length; i += 10) {
//             const batch = restaurants.slice(i, i + 10);

//             const checkResults = await Promise.all(
//                 batch.map(async (restaurant) => {
//                     const exists = await checkRestaurantInDatabase(restaurant);
//                     return { restaurant, exists };
//                 })
//             );

//             for (const { restaurant, exists } of checkResults) {
//                 if (exists && restaurant.distance <= radius) {
//                     filteredRestaurants.push(restaurant);
//                 }
//             }
//         }

//         filteredRestaurants.sort((a, b) => a.distance - b.distance);

//         return res.status(200).json({ success: true, data: filteredRestaurants });
//     } catch (error) {
//         console.error('Error fetching nearby restaurants:', error);
//         return res.status(500).json({ success: false, message: 'Error fetching nearby restaurants' });
//     } finally {
//         try {
//             await client.close();
//         } catch (error) {
//             console.error('Error closing MongoDB connection:', error);
//         }
//     }
// };

// const fetchRestaurantsByType = async (searchTerm, longitude, latitude, radius) => {
//     try {
//         const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchTerm)}.json`;

//         const response = await axios.get(mapboxUrl, {
//             params: {
//                 access_token: process.env.MAPBOX_ACCESS_TOKEN,
//                 proximity: `${longitude},${latitude}`
//             }
//         });

//         if (!response.data?.features) {
//             return [];
//         }

//         const answer = response.data.features.map(feature => ({
//             id: feature.id,
//             name: feature.text,
//             address: feature.place_name,
//             coordinates: feature.center,
//             distance: calculateDistance(
//                 latitude,
//                 longitude,
//                 feature.center[1],
//                 feature.center[0]
//             ),
//             category: searchTerm,
//             properties: feature.properties || {}
//         }));

//         return answer;
//     } catch (error) {
//         console.error(`Error fetching ${searchTerm}:`, error);
//         return [];
//     }
// };

// const calculateDistance = (lat1, lon1, lat2, lon2) => {
//     const R = 6371;
//     const dLat = toRad(lat2 - lat1);
//     const dLon = toRad(lon2 - lon1);

//     const a =
//         Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//         Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
//         Math.sin(dLon / 2) * Math.sin(dLon / 2);

//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//     return Math.round(R * c * 1000); // Convert to meters and round
// };

// const toRad = (value) => value * Math.PI / 180;

// module.exports = {
//     getNearbyRestaurants
// };

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

const generateSessionToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Modified to return _id directly
const checkRestaurantInDatabase = async (restaurantData) => {
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const Restaurant = db.collection("restaurants");

        const sanitizedName = restaurantData.name.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '');
        const restaurant = await Restaurant.findOne({
            restaurantName: {
                $regex: sanitizedName,
                $options: 'i',
            },
        });

        return restaurant ? { exists: true, _id: restaurant._id } : { exists: false };
    } catch (error) {
        console.error('Error checking restaurant in database:', error);
        return { exists: false };
    }
};

const getNearbyRestaurants = async (req, res) => {
    try {
        const { longitude, latitude, radius = 1000, category = 'all' } = req.query;

        if (!longitude || !latitude) {
            return res.status(400).json({ success: false, message: 'Longitude and latitude are required' });
        }

        const uniqueRestaurants = new Map();
        const sessionToken = generateSessionToken();

        if (category === 'all') {
            const results = await Promise.all([
                fetchRestaurantsByType("McDonald's", longitude, latitude, radius, sessionToken),
                fetchRestaurantsByType('pizza', longitude, latitude, radius, sessionToken),
                fetchRestaurantsByType('Starbucks', longitude, latitude, radius, sessionToken),
                fetchRestaurantsByType('Fast food restaurant', longitude, latitude, radius, sessionToken),
                fetchRestaurantsByType('burger', longitude, latitude, radius, sessionToken),
                fetchRestaurantsByType('restaurant', longitude, latitude, radius, sessionToken)
            ]);

            const flatResults = results.flat();
            const batchSize = 10;

            for (let i = 0; i < flatResults.length; i += batchSize) {
                const batch = flatResults.slice(i, i + batchSize);

                const checkResults = await Promise.all(
                    batch.map(async (restaurant) => {
                        const dbResult = await checkRestaurantInDatabase(restaurant);
                        return { restaurant, ...dbResult };
                    })
                );

                for (const { restaurant, exists, _id } of checkResults) {
                    if (exists && !uniqueRestaurants.has(restaurant.name)) {
                        uniqueRestaurants.set(restaurant.name, {
                            name: restaurant.name,
                            address: restaurant.address,
                            coordinates: restaurant.coordinates,
                            distance: restaurant.distance,
                            _id: _id // Include _id in the response
                        });
                    }
                }
            }
           
            const allRestaurants = Array.from(uniqueRestaurants.values())
                .filter((restaurant) => restaurant.distance <= radius)
                .sort((a, b) => a.distance - b.distance);

            return res.status(200).json({ success: true, data: allRestaurants });
        }

        // Handle single category search
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
            radius,
            sessionToken
        );

        const filteredRestaurants = [];
        for (let i = 0; i < restaurants.length; i += 10) {
            const batch = restaurants.slice(i, i + 10);

            const checkResults = await Promise.all(
                batch.map(async (restaurant) => {
                    const dbResult = await checkRestaurantInDatabase(restaurant);
                    return { restaurant, ...dbResult };
                })
            );

            for (const { restaurant, exists, _id } of checkResults) {
                if (exists && restaurant.distance <= radius) {
                    filteredRestaurants.push({
                        name: restaurant.name,
                        address: restaurant.address,
                        coordinates: restaurant.coordinates,
                        distance: restaurant.distance,
                        _id: _id // Include _id in the response
                    });
                }
            }
        }

        filteredRestaurants.sort((a, b) => a.distance - b.distance);
        return res.status(200).json({ success: true, data: filteredRestaurants });

    } catch (error) {
        console.error('Error fetching nearby restaurants:', error);
        return res.status(500).json({ success: false, message: 'Error fetching nearby restaurants' });
    } finally {
        try {
            await client.close();
        } catch (error) {
            console.error('Error closing MongoDB connection:', error);
        }
    }
};

const fetchRestaurantsByType = async (searchTerm, longitude, latitude, radius, sessionToken) => {
    try {
        const searchboxUrl = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(searchTerm)}`;
        
        const response = await axios.get(searchboxUrl, {
            params: {
                access_token: process.env.MAPBOX_ACCESS_TOKEN,
                proximity: `${longitude},${latitude}`,
                types: 'poi',
                limit: 10,
                language: 'en',
                session_token: sessionToken
            }
        });

        if (!response.data?.suggestions) {
            return [];
        }

        const suggestions = await Promise.all(
            response.data.suggestions.map(async (suggestion) => {
                if (!suggestion.mapbox_id) return null;

                const retrieveUrl = `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}`;
                const retrieveResponse = await axios.get(retrieveUrl, {
                    params: {
                        access_token: process.env.MAPBOX_ACCESS_TOKEN,
                        session_token: sessionToken
                    }
                });

                if (!retrieveResponse.data?.features?.[0]) return null;

                const feature = retrieveResponse.data.features[0];
                return {
                    name: feature.properties?.name || suggestion.name,
                    address: feature.properties?.full_address || suggestion.place_formatted,
                    coordinates: feature.geometry?.coordinates || [suggestion.longitude, suggestion.latitude],
                    distance: calculateDistance(
                        latitude,
                        longitude,
                        feature.geometry?.coordinates[1] || suggestion.latitude,
                        feature.geometry?.coordinates[0] || suggestion.longitude
                    )
                };
            })
        );

        return suggestions.filter(Boolean);
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
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 1000);
};

const toRad = (value) => value * Math.PI / 180;

module.exports = {
    getNearbyRestaurants
};