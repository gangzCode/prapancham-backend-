const mongoose = require('mongoose');

const adCategorySchema = mongoose.Schema({
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
                name: { type: String, default: '' },
                value: { type: String,required: true}
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
    }
})

exports.AdCategory = mongoose.model('AdCategory', adCategorySchema);