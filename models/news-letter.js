const mongoose = require('mongoose');

const newsLetterSchema = mongoose.Schema({
    email: {
        type: String,
        required: true,
    }
})


exports.NewsLetter = mongoose.model('NewsLetter', newsLetterSchema);
