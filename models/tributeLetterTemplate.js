const mongoose = require("mongoose");

const tributeLetterTemplateSchema = mongoose.Schema(
  {
    image: {
      type: String,
      default: ''
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
  },
  { timestamps: true }
);

exports.TributeLetterTemplate = mongoose.model("TributeLetterTemplate", tributeLetterTemplateSchema);
