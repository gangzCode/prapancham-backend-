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
    }
})

exports.Advertistment = mongoose.model('Advertistment', advertistmentSchema);