const mongoose = require('mongoose');

const obituaryRemembarancePackagesSchema = mongoose.Schema({
    name: {
        en: [
            {
                name: { type: String, required: true },
                value: { type: String, required: true }
            }
        ],
        ta: [
            {
                name: { type: String, required: true },
                value: { type: String, required: true }
            }
        ],
        si: [
            {
                name: { type: String, required: true },
                value: { type: String, required: true }
            }
        ]
    },
    addons: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Addons'
        }
    ],
    isObituary: {
        type: Boolean,
        default: false,
    },
    isRemembarace: {
        type: Boolean,
        default: false,
    },
    isPriority: {
        type: Boolean,
        default: false,
    },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    isPremium: {
        type: Boolean,
        default: false,
    },
    basePrice: {
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
    duration: {
        type: Number,
        min: 0,
        required: true,
    },
    description: {
        en: [
            {
                name: { type: String, required: true },
                value: { type: String, required: true }
            }
        ],
        ta: [
            {
                name: { type: String, required: true },
                value: { type: String, required: true }
            }
        ],
        si: [
            {
                name: { type: String, required: true },
                value: { type: String, required: true }
            }
        ]
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    isSocialSharing: {
        type: Boolean,
        default: false,
    },
    isSlideShow: {
        type: Boolean,
        default: false,
    },
    wordLimit: {
        type: Number,
        min: 0,
        required: true,
    },
    priceList:[
        {
        country: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Country'
        },
        price: {
            type: Number,
            min: 0,
            required: true,
        }, 
        }
    ],
    isTributeVideoUploading: {
        type: Boolean,
        default: false,
    },
    isAdditionalImages: {
        type: Boolean,
        default: false,
    },
    noofAdditionalImages: {
        type: Number,
        min: 0,
        required: false,
    },
    noofContectDetails: {
        type: Number,
        min: 0,
        required: false,
    },
    noofBgColors: {
        type: Number,
        min: 0,
        required: false,
    },
    bgColors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ObituraryPostBgColor'
    }],
    noofPrimaryImageBgFrames: {
        type: Number,
        min: 0,
        required: false,
    },
    primaryImageBgFrames:[ {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ObituraryPostPrimaryImageFrame'
    }],
    isActive: {
        type: Boolean,
        default: true,
    }
})

exports.ObituaryRemembarancePackages = mongoose.model('ObituaryRemembarancePackages', obituaryRemembarancePackagesSchema);