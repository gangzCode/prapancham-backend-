const mongoose = require('mongoose');

const obituraryPostBgColorSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    colorCode: {
        type: String,
        required: true,
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

exports.ObituraryPostBgColor = mongoose.model('ObituraryPostBgColor', obituraryPostBgColorSchema);