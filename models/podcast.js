const mongoose = require("mongoose");

const youtubeNewsSchema = mongoose.Schema(
  {
    title: {
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
    creatorName: {
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
    podcastLink: {
      type: String,
      required: false,
    },
    podcastRunTime: {
        type: String,
        required: false,
    },
    podcastCategory: {
      type: String,
      required: false,
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

exports.Podcast = mongoose.model("Podcast", youtubeNewsSchema);