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

exports.Faq = mongoose.model("Faq", faqSchema);
