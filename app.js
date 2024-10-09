const express = require('express');
const connectDB = require('./config/db'); // Import the DB connection
const userRoutes = require('./routes/userRoutes');
const cors = require('cors');
const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert(require('./config/hungerx-36500-firebase-adminsdk-8cm6x-95bae7312e.json')),
  });

const app = express();

// Connect to the database
connectDB();

// Middleware
app.use(express.json());
app.use(cors()); 

// Routes
app.use('/users', userRoutes);

// Start server
const PORT = process.env.PORT || 3000; // Default to port 3000 if process.env.PORT is not set
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

