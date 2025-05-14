const mongoose = require('mongoose');

const tributeItemSchema = mongoose.Schema({
    cardTemplateImages: [
        {
            type: String,
            default: ''
        }
    ],
    letterTemplateImages: [
        {
            type: String,
            default: ''
        }
    ],
    memoryImages: [
        {
            type: String,
            default: ''
        }
    ],
    flowerTribute: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FlowerType'
        }
    ],
    message: {
        type: String,
        required: false,
    },
    name: {
        type: String,
        required: false,
    },
    userName: {
        type: String,
        required: false,
    },
    relationship: {
        type: String,
        required: false,
    },
    country : {
        type: String,
        required: false,
    },
    email: {
        type: String,
        required: false,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    tributeOptions: {
        type: String,
        enum: ['message', 'card', 'letter','memory','flower'],
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    }
})

exports.TributeItem = mongoose.model('TributeItem', tributeItemSchema);