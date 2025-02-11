const mongoose = require('mongoose');
const User = require('../models/userModel');



let dbInstance;

const connectDB = async () => {
    try {
        if (!process.env.DB_URI) {
            throw new Error('MongoDB connection string (DB_URI) is not defined in environment variables');
        }

        const connection = await mongoose.connect(process.env.DB_URI, {
        });
        
        dbInstance = connection.connection.db;
        console.log('Connected to MongoDB');

        const userCount = await User.countDocuments();
        console.log(`👥 Total Users: ${userCount}`);
        
        return dbInstance;
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

const getDBInstance = () => {
    if (!dbInstance) throw new Error('Database not initialized. Call connectDB first.');
    return dbInstance;
};

module.exports = { connectDB, getDBInstance };