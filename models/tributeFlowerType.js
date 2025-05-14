const mongoose = require("mongoose");

const tributeFlowerTypeSchema = mongoose.Schema(
  {
    image: {
      type: String,
      default: ''
    },
    name: {
        type: String,
        required: true,
      },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    priceList:[
      {
          country: {
              type: String,
              required: true,
          },
          currencyCode: {
              type: String,
              required: true,
          },
          price: {
              type: Number,
              min: 0,
              required: true,
          }, 
      }
    ],
    isActive: {
      type: Boolean,
      default: true,
    }
    },
  { timestamps: true }
);

exports.TributeFlowerType = mongoose.model("TributeFlowerType", tributeFlowerTypeSchema);
