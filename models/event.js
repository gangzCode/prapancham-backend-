const mongoose = require("mongoose");

const eventSchema = mongoose.Schema(
  {
    name: {
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
    description: {
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
    eventDate: {
        type: String,
        required: true,
      },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    image: {
      type: String,
      default: ''
    },
    featuredEventImage: {
      type: String,
      default: ''
    },
    eventLink: {
      type: String,
      required: false,
    },
    registeredPeopleCount: {
      type: String,
      required: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    uploadedDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: String,
      required:true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

exports.Event = mongoose.model("Event", eventSchema);