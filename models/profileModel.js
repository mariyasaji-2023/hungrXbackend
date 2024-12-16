const mongoose = require('mongoose')

const profileSchema = new mongoose.Schema({
  male: String,
  female: String,
});

module.exports = mongoose.model('Profile', profileSchema);
