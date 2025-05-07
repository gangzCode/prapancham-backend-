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
                type: String,
                default: '',
                required: true,
            },
            countrySpecificPrice: {
                type: Number,
                min: 0,
                required: true,
            }, 
        }
    ],
})

exports.Addons = mongoose.model('Addons', addonsSchema);