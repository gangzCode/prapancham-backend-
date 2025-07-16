const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      required: false,
    },
    country: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: false,
    },
    image: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ObituaryRemembarancePackages'
    }],
  },
  { timestamps: true }
);

exports.User = mongoose.model("User", UserSchema);