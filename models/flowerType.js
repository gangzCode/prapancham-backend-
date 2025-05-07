const mongoose = require("mongoose");

const flowerTypechema = mongoose.Schema(
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
                default: '',
                required: true,
            },
            countrySpecificPrice: {
                type: Number,
                min: 0,
                required: true,
            }, 
        }
      ],
    },
  { timestamps: true }
);

exports.FlowerType = mongoose.model("FlowerType", flowerTypechema);
