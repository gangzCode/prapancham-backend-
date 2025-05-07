const mongoose = require("mongoose");

const tributeCardTemplateSchema = mongoose.Schema(
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

exports.TributeCardTemplate = mongoose.model("TributeCardTemplate", tributeCardTemplateSchema);
