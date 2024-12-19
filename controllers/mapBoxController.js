const userModel = require('../models/userModel')

// controllers/restaurantController.js
const axios = require('axios');

const VALID_CATEGORIES = {
    'indian': 'indian restaurant',
    'pizza': 'pizza',
    'cafe': 'cafe',
    'Fast food restaurant': 'Fast food restaurant',  // Added fast food category
    'burger': 'burger', 
    'restaurant': 'restaurant' 
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

        // If category is 'all', fetch all types of places
        if (category === 'all') {
            const results = await Promise.all([
                fetchRestaurantsByType('indian restaurant', longitude, latitude, radius),
                fetchRestaurantsByType('pizza', longitude, latitude, radius),
                fetchRestaurantsByType('cafe', longitude, latitude, radius),
                fetchRestaurantsByType('Fast food restaurant', longitude, latitude, radius),
                fetchRestaurantsByType('burger', longitude, latitude, radius),
                fetchRestaurantsByType('restaurant', longitude, latitude, radius),
                fetchRestaurantsByType('chinese restaurant', longitude, latitude, radius),
                fetchRestaurantsByType('japanese restaurant', longitude, latitude, radius)
            ]);

            // Use a Map to deduplicate by restaurant ID
            const uniqueRestaurants = new Map();

            results.flat().forEach(restaurant => {
                // Only add if we haven't seen this restaurant before
                if (!uniqueRestaurants.has(restaurant.id)) {
                    // Determine the most appropriate category based on the restaurant's properties
                    const propertyCategory = (restaurant.properties.category || '').toLowerCase();
                    let assignedCategory = 'restaurant'; // default category

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
            });

            // Convert Map back to array and sort by distance
            const allRestaurants = Array.from(uniqueRestaurants.values())
                .sort((a, b) => a.distance - b.distance);

            return res.status(200).json({
                success: true,
                data: allRestaurants
            });
        }

        // For specific category requests
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

        return res.status(200).json({
            success: true,
            data: restaurants
        });

    } catch (error) {
        console.error('Error fetching nearby restaurants:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching nearby restaurants',
            error: error.message
        });
    }
};

const fetchRestaurantsByType = async (searchTerm, longitude, latitude, radius) => {
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchTerm)}.json`;
    
    try {
        const response = await axios.get(mapboxUrl, {
            params: {
                access_token: process.env.MAPBOX_ACCESS_TOKEN,
                proximity: `${longitude},${latitude}`,
                limit: 10,
                types: 'poi',
                bbox: getBoundingBox(latitude, longitude, radius),
            }
        });

        return response.data.features.map(feature => {
            // Get the actual category from the properties
            const propertyCategory = (feature.properties?.category || '').toLowerCase();
            
            return {
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
                properties: {
                    ...feature.properties,
                    originalCategory: propertyCategory
                }
            };
        });
    } catch (error) {
        console.error(`Error fetching ${searchTerm} locations:`, error);
        return [];
    }
};
// Helper functions remain the same
const getBoundingBox = (latitude, longitude, radius) => {
    const radiusInDegrees = radius / 111300;
    const minLat = latitude - radiusInDegrees;
    const maxLat = latitude + radiusInDegrees;
    const minLng = longitude - radiusInDegrees / Math.cos(latitude * Math.PI / 180);
    const maxLng = longitude + radiusInDegrees / Math.cos(latitude * Math.PI / 180);
    return [minLng, minLat, maxLng, maxLat].join(',');
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
    return Math.round(R * c * 1000); // Convert to meters and round
};

const toRad = (value) => value * Math.PI / 180;

module.exports = {
    getNearbyRestaurants
};