// models/Recipe.js
const mongoose = require('mongoose');
// Define the main Recipe schema with embedded stage and nutrition schemas
const RecipeSchema = new mongoose.Schema({
    userId: {
        type: String,
    },
    recipe_name: {
        type: String,
        required: true
    },
    total_time: {
        type: Number,
        required: true
    },
    stages: [{
        Step: {
            type: Number,
            required: true
        },
        Title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        duration: {
            type: Number,
            required: true
        }
    }],
    nutrition: {
        calories: {
            type: Number,
            required: true
        },
        protein: {
            type: Number,
            required: true
        },
        carbs: {
            type: Number,
            required: true
        },
        fat: {
            type: Number,
            required: true
        }
    },
    ingredients: [{
        type: String
    }],
    cuisine: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });
// Create and export the Recipe model
const Recipe = mongoose.model('Recipe', RecipeSchema);
module.exports = Recipe;