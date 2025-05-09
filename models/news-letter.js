const mongoose = require('mongoose');

const newsLetterSchema = mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    }
})


exports.NewsLetter = mongoose.model('NewsLetter', newsLetterSchema);
