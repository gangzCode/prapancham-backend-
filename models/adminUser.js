const mongoose = require("mongoose");

const adminUserSchema = new mongoose.Schema(
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
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      required: false,
    },
    adminAccessPages: [{
            type: String,
            enum: ['Dashboard', 'Obituary', 'Advertistment','News','Events','Tribute','ContactUs','FAQ','Country','Newsletter','Youtube','Podcast','Quote'],
            required: true, 
    }],
  },
  { timestamps: true }
);

exports.AdminUser = mongoose.model("AdminUser", adminUserSchema);
