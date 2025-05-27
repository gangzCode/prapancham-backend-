const mongoose = require("mongoose");

const contactUsFormSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true
    },
    country: {
      type: String,
      default: false,
      required: true,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    }
  },
  { timestamps: true }
);

exports.ContactUsForm = mongoose.model("ContactUsForm", contactUsFormSchema);
