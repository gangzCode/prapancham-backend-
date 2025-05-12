const mongoose = require("mongoose");

const newsSchema = mongoose.Schema(
  {
    title: {
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
                name: { type: String, required: true },
                value: { type: String, required: true }
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
                name: { type: String, required: true },
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
    thumbnailImage: {
        type: String,
        default: ''
    },
    mainImage: {
        type: String,
        default: ''
    },
    thumbnailImage: {
        type: String,
        default: ''
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    otherImages: [
        {
            type: String,
            default: ''
        }
    ],
    paragraphs: [
        {
            en: [
                {
                    name: { type: String, required: false },
                    value: { type: String, required: false }
                }
            ],
            ta: [
                {
                    name: { type: String, required: false },
                    value: { type: String, required: false }
                }
            ],
            si: [
                {
                    name: { type: String, required: false },
                    value: { type: String, required: false }
                }
            ]
        }
    ],
    editorName: {
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
                name: { type: String, required: true },
                value: { type: String, required: true }
            }
        ]
    },
    newsCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NewsCategory'
    },
    isBreakingNews: {
        type: Boolean,
        default: false,
    },
    isImportantNews: {
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

exports.News = mongoose.model("News", newsSchema);
