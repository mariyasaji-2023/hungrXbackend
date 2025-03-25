const referralCodeSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    length: 6
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
