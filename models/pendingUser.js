const mongoose = require("mongoose");

const pendingUserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  hashedPassword: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 },
  verified: { type: Boolean, default: false },
});

exports.PendingUser = mongoose.model("PendingUser", pendingUserSchema);