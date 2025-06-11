const mongoose = require("mongoose");

const countrySchema = mongoose.Schema(
  {
    name: {
      en: [
            {
                name: { type: String, required: true },
                value: { type: String, required: true }
            }
        ],
        ta: [
            {
                name: { type: String, required: true },
                value: { type: String, required: true }
            }
        ],
        si: [
            {
                name: { type: String, required: true},
                value: { type: String, required: true }
            }
        ]
    },
    currencyCode: {
        type: String,
        required: true,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    image: {
        type: String,
        default: ''
    }
  },
  { timestamps: true }
);

exports.Country = mongoose.model("Country", countrySchema);
