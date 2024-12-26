const express = require('express');
const { connectDB } = require('./config/db');
const userRoutes = require('./routes/userRoutes')
const cors = require('cors');
require('dotenv').config();

const app = express();
connectDB();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use('/users', userRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

