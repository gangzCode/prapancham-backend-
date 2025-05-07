const mongoose = require('mongoose');

const obituraryPostBgColorSchema = mongoose.Schema({
    colorCode: {
        type: String,
        required: true,
    }
})

exports.ObituraryPostBgColor = mongoose.model('ObituraryPostBgColor', obituraryPostBgColorSchema);