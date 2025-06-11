const mongoose = require('mongoose');

const addonsSchema = mongoose.Schema({
    name: {
        en: [
            {
                name: { type: String, required: true },
                value: { type: String, required: true }
            }
        ],
        ta: [
            {
                name: { type: String, required: true},
                value: { type: String, required: true }
            }
        ],
        si: [
            {
                name: { type: String, default: '' },
                value: { type: String,required: true}
            }
        ]
    },
    isDeleted: {
        type: Boolean,
        default: false,
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
    isActive: {
        type: Boolean,
        default: true,
    }
})

exports.Addons = mongoose.model('Addons', addonsSchema);