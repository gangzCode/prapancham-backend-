const mongoose = require("mongoose");

const orderSchema = mongoose.Schema(
  {
    username: {
        type: String,
        required: true,
    },
    information:{
        title: {
            type: String,
            default: ''
        },
        address: {
            type: String,
            default: ''
        },
        dateofBirth: {
            type: String,
            default: ''
        },
        dateofDeath: {
            type: String,
            default: ''
        },
        shortDescription: {
            type: String,
            default: ''
        },
        description: {
            type: String,
            default: ''
        },
        tributeVideo: {
            type: String,
            default: ''
        },
    },
    basePackagePrice: {
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
    accountDetails:{
        bankName: {
            type: String,
            default: '',
            required: false
        },
        branchName: {
            type: String,
            default: '',
            required: false
        },
        accountNumber: {
            type: Number,
            min: 0,
            required: false
        },
        accountHolderName: {
            type: String,
            default: '',
            required: false
        }
    },
    contactDetails:[
        {
            country: {
                type: String,
                required: true,
            },
            address: {
                type: String,
                required: true,
            },
            phoneNumber: {
                type: String,
                required: true,
            },
            name: {
                type: String,
                required: true,
            },
            relationship: {
                type: String,
                required: true,
            },
            email: {
                type: String,
                required: true,
            },
        }
    ],
    primaryImage: {
        type: String,
        default: ''
    },
    thumbnailImage: {
        type: String,
        default: ''
    },
    selectedPrimaryImageBgFrame: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ObituraryPostPrimaryImageFrame'
    },
    selectedAddons: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Addons'
    }
    ],
    selectedBgColor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ObituraryPostBgColor'
    },
    additionalImages: [
        {
            type: String,
            default: ''
        }
    ],
    slideshowImages: [
        {
            type: String,
            default: ''
        }
    ],
    isDeleted: {
        type: Boolean,
        default: false,
    },
    selectedPackage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ObituaryRemembarancePackages'
    },
    selectedCountry: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Country'
    },
    orderStatus: {
        type: String,
        enum: ['Review Requested', 'Post Approved', 'Approval Denied', 'Requested for Changes','Expired','Refunded'],
        required: true, 
        default: 'Review Requested'
    },
    tributeItems: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TributeItem'
    }],
    expiryDate: {
      type: String,
      required:true,
      default: ''
    },
    recievedDonations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Donation'
    }],
    donationRecieved: {
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
    donationGivenBack: {
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
    userDonationStatus: {
            type: String,
            enum: ['Donation Needs To Be Sent', 'Donation Sent To User', 'Donation Recieved By User'],
            required: true, 
            default: 'Donation Needs To Be Sent'
    },
    memoryImageMoneyRecieved: {
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
    flowerMoneyRecieved: {
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
    isDonationReceivable: {
        type: Boolean,
        default: false,
    }
  },
  { timestamps: true }
);

exports.Order = mongoose.model("Order", orderSchema);