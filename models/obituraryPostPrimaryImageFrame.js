const mongoose = require('mongoose');

const obituraryPostPrimaryImageFrameSchema = mongoose.Schema({
    frameImage: {
        type: String,
        default: ''
    }
})

exports.ObituraryPostPrimaryImageFrame = mongoose.model('ObituraryPostPrimaryImageFrame', obituraryPostPrimaryImageFrameSchema);