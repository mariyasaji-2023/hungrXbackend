const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/userModel');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.DB_URI;

const searchHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    query: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    resultCount: { type: Number, default: 0 }
}, {
    timestamps: true
});

const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);

// Helper function to save search history
const saveUserSearchHistory = async (searchData) => {
    try {
        const searchHistory = new SearchHistory(searchData);
        await searchHistory.save();
    } catch (error) {
        console.error("Error saving search history:", error);
        // Don't throw error to prevent search failure
    }
};

const searchDishesForUser = async (req, res) => {
    const { query, userId } = req.body;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Connected to MongoDB");
        const db = client.db('hungerX');
        const collection = db.collection('restaurants');
        
        if (!userId) {
            return res.status(400).json({
                status: false,
                error: 'User ID is required'
            });
        }

        const restaurants = await collection.find({
            "menus.dishes.name": { 
                $regex: query ? new RegExp(query, 'i') : /.*/ 
            }
        }).toArray();
        
        console.log(restaurants, 'rrrrrrrrrrrrrrrrrrrrr');

        if (!restaurants || restaurants.length === 0) {
            return res.status(404).json({
                status: false,
                error: 'No restaurants found'
            });
        }

        // If query is empty, return popular dishes from all restaurants
        if (!query || query.trim() === '') {
            const popularDishes = restaurants.reduce((dishes, restaurant) => {
                if (!restaurant?.menus?.[0]?.dishes) {
                    return dishes;
                }
                
                const restaurantDishes = restaurant.menus[0].dishes
                    .slice(0, 4)
                    .map(dish => ({
                        id: dish.id,
                        name: dish.name,
                        image: dish.image,
                        price: dish.price || 0,
                        nutrition: dish.nutritionFacts,
                        restaurantName: restaurant.name,
                        restaurantId: restaurant.id,
                        type: 'popular'
                    }));
                return [...dishes, ...restaurantDishes];
            }, []).slice(0, 12);

            return res.status(200).json({
                status: true,
                data: {
                    suggestions: popularDishes,
                    type: 'popular_items'
                }
            });
        }

        // Search through all restaurants and their menus
        const searchResults = restaurants.reduce((allResults, restaurant) => {
            if (!restaurant?.menus) return allResults;

            const restaurantResults = restaurant.menus.reduce((menuResults, menu) => {
                if (!menu?.dishes) return menuResults;

                const matchingDishes = menu.dishes
                    .filter(dish => {
                        if (!dish?.name) return false;
                        return dish.name.toLowerCase().includes(query.toLowerCase());
                    })
                    .map(dish => {
                        const exactMatch = dish.name.toLowerCase() === query.toLowerCase();
                        const startsWithMatch = dish.name.toLowerCase().startsWith(query.toLowerCase());
                        const score = exactMatch ? 1 : startsWithMatch ? 0.8 : 0.6;

                        return {
                            id: dish.id,
                            name: dish.name,
                            image: dish.image,
                            price: dish.price || 0,
                            description: dish.description || '',
                            servingInfo: dish.servingInfo,
                            nutritionFacts: dish.nutritionFacts,
                            type: 'dish',
                            menuName: menu.name,
                            restaurantId: restaurant.id,
                            restaurantName: restaurant.name,
                            restaurantLogo: restaurant.logo,
                            relevanceScore: score,
                            highlight: {
                                name: dish.name.replace(
                                    new RegExp(`(${query})`, 'gi'),
                                    '<strong>$1</strong>'
                                )
                            }
                        };
                    });

                return [...menuResults, ...matchingDishes];
            }, []);

            return [...allResults, ...restaurantResults];
        }, []);

        // Sort results by relevance
        searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Group by restaurants
        const groupedResults = searchResults.reduce((groups, dish) => {
            const restaurantName = dish.restaurantName;
            if (!groups[restaurantName]) {
                groups[restaurantName] = {
                    restaurantId: dish.restaurantId,
                    restaurantName: dish.restaurantName,
                    restaurantLogo: dish.restaurantLogo,
                    dishes: []
                };
            }
            groups[restaurantName].dishes.push(dish);
            return groups;
        }, {});

        const startTime = Date.now();

        // Save search history
        await saveUserSearchHistory({
            userId,
            query,
            timestamp: new Date(),
            resultCount: searchResults.length
        });

        return res.status(200).json({
            status: true,
            data: {
                query: query,
                results: groupedResults,
                suggestions: searchResults.slice(0, 10).map(dish => ({
                    id: dish.id,
                    name: dish.name,
                    highlight: dish.highlight,
                    restaurantName: dish.restaurantName,
                    type: 'suggestion'
                })),
                totalResults: searchResults.length,
                metadata: {
                    timeTaken: Date.now() - startTime,
                    resultCount: searchResults.length,
                    restaurantsCount: Object.keys(groupedResults).length
                }
            }
        });

    } catch (error) {
        console.error("Error searching dishes:", error);
        return res.status(500).json({
            status: false,
            error: 'Failed to search dishes',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        await client.close();
    }
};

module.exports = { searchDishesForUser };