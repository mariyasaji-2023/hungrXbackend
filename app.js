const express = require('express');
const connectDB = require('./config/db'); // Import the DB connection
const userRoutes = require('./routes/userRoutes');
const cors = require('cors');
const admin = require('firebase-admin');
const serviceAccount = require('./config/hungrx-ffe5b-firebase-adminsdk-kd7ww-b9476d29c1.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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

