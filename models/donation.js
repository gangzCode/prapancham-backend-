const mongoose = require("mongoose");

const donationSchema = mongoose.Schema(
  {
    isDeleted: {
        type: Boolean,
        default: false,
    },
    email: {
        type: String,
        required: false,
    },
    name: {
        type: String,
        required: false,
    },
    address: {
        type: String,
        required: false,
    },
    phoneNumber: {
        type: String,
        required: false,
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
    adminDonationStatus: {
        type: String,
        enum: ['Donation Recieved', 'Donation Given To User','Unable to Send Donation to User'],
        required: true, 
        default: 'Donation Recieved'
    },
    userDonationStatus: {
        type: String,
        enum: ['Donation Needs To Be Sent', 'Donation Sent To User', 'Donation Recieved By User'],
        required: true, 
        default: 'Donation Needs To Be Sent'
    },
    order:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
    },
  },
  { timestamps: true }
);

exports.Donation = mongoose.model("Donation", donationSchema);