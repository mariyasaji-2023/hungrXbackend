
const axios = require('axios');
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DB_URI);
const getValidCategories = async () => {
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME);
        const categoriesCollection = db.collection("categories");

        // Find all categories and convert to array
        const categories = await categoriesCollection.find({}).toArray();

        // Convert array to object format needed for validation
        const validCategories = {};
        categories.forEach(category => {
            validCategories[category.name] = category.name;
        });

        return validCategories;
    } catch (error) {
        console.error('Error fetching categories:', error);
        return {};
    }
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
        const VALID_CATEGORIES = await getValidCategories()
        const { longitude, latitude, radius = 1000, category = 'all' } = req.query;

        if (!longitude || !latitude) {
            return res.status(400).json({ success: false, message: 'Longitude and latitude are required' });
        }
        if (!VALID_CATEGORIES[category] && category !== 'all') {
            return res.status(400).json({
                success: false,
                message: 'Invalid category. Valid categories are: ' + Object.keys(VALID_CATEGORIES).join(', ')
            });
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
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 1000);
};

const toRad = (value) => value * Math.PI / 180;

module.exports = {
    getNearbyRestaurants
};