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

exports.TributeFlowerType = mongoose.model("TributeFlowerType", tributeFlowerTypeSchema);
