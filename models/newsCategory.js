const mongoose = require('mongoose');

const newsCategorySchema = mongoose.Schema({
    name: {
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
    isDeleted: {
        type: Boolean,
        default: false,
    }
})

exports.NewsCategory = mongoose.model('NewsCategory', newsCategorySchema);