const mongoose = require("mongoose");

const faqSchema = mongoose.Schema(
  {
    question: {
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
    answer: {
      en: [
            {
                name: { type: String, required: true},
                value: { type: String, required: true }
            }
        ],
        ta: [
            {
                name: { type: String,required: true},
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
    isDeleted: {
        type: Boolean,
        default: false,
    },
    listingNumber: {
      type: Number,
        min: 0
    },
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  { timestamps: true }
);

exports.Faq = mongoose.model("Faq", faqSchema);
