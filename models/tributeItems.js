const mongoose = require('mongoose');

const tributeItemSchema = mongoose.Schema({
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
    },
    order:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    message:{
        message: {
            type: String,
            required: false,
        },
        name: {
            type: String,
            required: false,
        },
        relationship: {
            type: String,
            required: false,
        },
        country: {
            type: String,
            required: false,
        },
    },
    card:{
        cardTemplate: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TributeCardTemplate'
        },
        message: {
            type: String,
            required: false,
        },
        name: {
            type: String,
            required: false,
        },
        relationship: {
            type: String,
            required: false,
        },
        country: {
            type: String,
            required: false,
        },
    },
    letter:{
        letterTemplate: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TributeLetterTemplate'
        },
        message: {
            type: String,
            required: false,
        },
        from: {
            type: String,
            required: false,
        },
        to: {
            type: String,
            required: false,
        },
        addressLineOne: {
            type: String,
            required: false,
        },
        addressLineTwo: {
            type: String,
            required: false,
        },
        addressLineThree: {
            type: String,
            required: false,
        },
    },
    memory:{
        images: {
            type: String,
            default:'',
        },
        email: {
            type: String,
            required: false,
        },
        message: {
            type: String,
            required: false,
        },
        name: {
            type: String,
            required: false,
        },
        relationship: {
            type: String,
            required: false,
        },
        country: {
            type: String,
            required: false,
        },
        finalPriceInCAD: {
            price: {
                type: Number,
                min: 0,
                required: false,
            },
            currencyCode: {
                type: String,
                default: 'CAD',
            }
        },
        finalPrice: {
            country: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Country'
            },
            price: {
                type: Number,
                min: 0,
                required: true,
            }, 
        },
    },
    flower: {
        flowerType: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TributeFlowerType'
        },
        message: {
            type: String,
            required: false,
        },
        email: {
            type: String,
            required: false,
        },
        finalPriceInCAD: {
            price: {
                type: Number,
                min: 0,
                required: false,
            },
            currencyCode: {
                type: String,
                default: 'CAD',
            }
        },
        name: {
            type: String,
            required: false,
        },
        relationship: {
            type: String,
            required: false,
        },
        country: {
            type: String,
            required: false,
        },
        deliveryStatus: {
            type: String,
            enum: ['Payment Needs To Be Done','Needs To Be Delivered', 'Delivered','Cancelled'],
            required: true, 
            default: 'Payment Needs To Be Done'
        },
    },
    tributeStatus: {
        type: String,
        enum: ['Review Requested', 'Tribute Approved', 'Approval Denied','Expired'],
        required: true, 
        default: 'Review Requested'
    },
})

exports.TributeItem = mongoose.model('TributeItem', tributeItemSchema);