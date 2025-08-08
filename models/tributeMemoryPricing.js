const mongoose = require("mongoose");

const tributeMemoryPricingSchema = mongoose.Schema(
  {
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
                         type: mongoose.Schema.Types.ObjectId,
                          ref: 'Country'
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

exports.TributeMemoryPricing = mongoose.model("TributeMemoryPricing", tributeMemoryPricingSchema);
