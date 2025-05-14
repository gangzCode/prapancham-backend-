const mongoose = require('mongoose');

const obituraryPostPrimaryImageFrameSchema = mongoose.Schema({
    frameImage: {
        type: String,
        default: ''
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

exports.ObituraryPostPrimaryImageFrame = mongoose.model('ObituraryPostPrimaryImageFrame', obituraryPostPrimaryImageFrameSchema);