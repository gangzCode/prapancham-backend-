const mongoose = require("mongoose");

const quotesSchema = mongoose.Schema(
  {
    quote: {
      en: [
        {
            name: { type: String,required: true },
            value: { type: String,required: true }
        }
    ],
    ta: [
        {
            name: { type: String, required: true },
            value: { type: String, required: true}
        }
    ],
    si: [
        {
            name: { type: String, required: true },
            value: { type: String,required: true }
        }
    ]
    },
    name: {
      en: [
        {
            name: { type: String, required: true },
            value: { type: String, required: true }
        }
        ],
        ta: [
            {
                name: { type: String, required: true},
                value: { type: String, required: true }
            }
        ],
        si: [
            {
                name: { type: String, required: true },
                value: { type: String, required: true }
            }
        ]
    },
    posistion: {
        en: [
          {
              name: { type: String, required: true },
              value: { type: String, required: true }
          }
          ],
          ta: [
              {
                  name: { type: String, required: true},
                  value: { type: String, required: true }
              }
          ],
          si: [
              {
                  name: { type: String, required: true },
                  value: { type: String, required: true }
              }
          ]
    }, 
    image: {
      type: String,
      default: ''
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  { timestamps: true }
);

exports.Quotes = mongoose.model("Quotes", quotesSchema);