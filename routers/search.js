// const express = require('express');
// const {Product} = require("../models/product");
// const router = express.Router();

// router.get('/quickSearch/:terms', async (req, res) => {
//     try {
//         const term = req.params.terms;
//         const products = await Product.find(
//             {
//                 $or: [
//                     {'name': {"$regex": term, "$options": "i"}},
//                     {'description': {"$regex": term, "$options": "i"}},
//                     {'richDescription': {"$regex": term, "$options": "i"}},
//                     /*{'brand': {"$regex": term, "$options": "i"}},
//                     {'filterList': {"$regex": term, "$options": "i"}},*/
//                 ]
//             },
//             {_id: 1, name: 1, price: 1, discountedPrice: 1, image: 1, imageAlt: 1, description: 1,variations:1}
//         ).sort({_id: -1}).limit(6);
//         if (!products) {
//             return res.status(500).json({success: false})
//         }
//         res.send(products);
//     } catch (e) {
//         console.error(e)
//         return res.status(500).json({success: false})
//     }
// })

// module.exports = router;
