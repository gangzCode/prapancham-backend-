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
    isFeatured: {
        type: Boolean,
        default: false,
    },
    image: {
      type: String,
      default: ''
    },
    featuredYoutubeImage: {
      type: String,
      default: ''
    },
    youtubeLink: {
      type: String,
      required: false,
    },
    youtubeRunTime: {
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

exports.YoutubeNews = mongoose.model("YoutubeNews", youtubeNewsSchema);