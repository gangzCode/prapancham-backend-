const mongoose = require("mongoose");

const forgetPasswordCodeSchema = mongoose.Schema(
  {
    email: { type: String, required: true },
    code: { type: String, required: true },
    verified: {
        type: Boolean,
        default: false,
    },
    createdAt: { type: Date, default: Date.now, expires: 300 },
  },
  { timestamps: true }
);

exports.ForgetPasswordCode = mongoose.model("ForgetPasswordCode", forgetPasswordCodeSchema);
