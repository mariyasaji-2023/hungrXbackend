// test-db.js
const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.DB_URI;
console.log("Connection string (hiding password):", 
  uri.replace(/\/\/([^:]+):([^@]+)@/, "//\$1:****@"));

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => {
  console.log("MongoDB connection successful!");
  return mongoose.connection.close();
})
.then(() => console.log("Connection closed."))
.catch(err => console.error("Connection error:", err));