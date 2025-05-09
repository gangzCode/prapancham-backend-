const mongoose = require('mongoose');

const adTypeSchema = mongoose.Schema({
    imageSize: {
        type: String,
        required: true,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    type: {
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    }
})

exports.AdType = mongoose.model('AdType', adTypeSchema);