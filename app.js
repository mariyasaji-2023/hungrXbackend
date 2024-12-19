const express = require('express');
const {connectDB} = require('./config/db'); // Import the DB connection
const userRoutes = require('./routes/userRoutes')
const cors = require('cors');
require('dotenv').config();

const app = express();

// Connect to the database
connectDB();

// Middleware
app.use(express.json());
// app.use(cors()); 
app.use(cors({
  origin: '*', // Replace with your Flutter app's domain in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Routes
app.use('/users', userRoutes);

// Start server
const PORT = process.env.PORT || 3000; // Default to port 3000 if process.env.PORT is not set
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

