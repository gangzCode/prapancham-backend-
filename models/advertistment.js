const mongoose = require('mongoose');

const advertistmentSchema = mongoose.Schema({
    image: {
        type: String,
        default: ''
    },
    link: {
        type: String,
        required: false,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    adType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdType',
        required: true,
    },
    adPageName: {
        type: String,
        enum: ['home', 'contact', 'events','news','obituary','create-memorial'],
        required: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    uploadedDate: {
        type: Date,
        default: Date.now,
    },
    expiryDate: {
        type: String,
        required:true,
    }
})

exports.Advertistment = mongoose.model('Advertistment', advertistmentSchema);