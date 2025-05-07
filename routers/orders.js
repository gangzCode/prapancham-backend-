// const express = require("express");
// const http = require("https");
// const router = express.Router();
// const { Order } = require("../models/order");
// const { OrderItem } = require("../models/order-item");
// const { verifyToken, verifyTokenAndAdmin } = require("./verifyToken");
// const { Cart } = require("../models/cart");
// const { auth0Verify } = require("./auth0-verify");
// const { Product } = require("../models/product");
// const { ShippingPrice } = require("../models/shippingPrice");
// const generateReport = require("../report/generate-report");
// const cors = require("cors");
// const { ClientAddress } = require("../models/clients-address");
// const countryList = require("react-select-country-list");
// // const {sendOrderPlacedEmail} = require("../report/mailgun");
// const { sendOrderPlacedEmail, sendOrderUpdateEmail } = require("../report/nodemailer");
// const { link } = require("fs");
// const request = require("request");
// const { Tax } = require("../models/tax");

// //CREATE
// router.post("/", verifyToken, async (req, res) => {
//   const orderItemsIds = Promise.all(
//     req.body.orderItems.map(async (orderitem) => {
//       let newOrderItem = new OrderItem({
//         quantity: orderitem.quantity,
//         product: orderitem.product,
//       });

//       newOrderItem = await newOrderItem.save();

//       return newOrderItem._id;
//     })
//   );

//   const orderItemsIdsResolved = await orderItemsIds;

//   let order = new Order({
//     orderItems: orderItemsIdsResolved,
//     shippingAddress1: req.body.shippingAddress1,
//     shippingAddress2: req.body.shippingAddress2,
//     city: req.body.city,
//     zip: req.body.zip,
//     country: req.body.country,
//     phone: req.body.phone,
//     status: req.body.status,
//     totalPrice: req.body.totalPrice,
//     user: req.body.user,
//   });

//   order = await order.save();

//   if (!order) return res.status(400).send("the order cannot be created!");

//   return res.status(200).send(order);
// });

// //UPDATE
// router.put("/:id", verifyTokenAndAdmin, async (req, res) => {
//   const order = await Order.findByIdAndUpdate(
//     req.params.id,
//     {
//       status: req.body.status,
//     },
//     { new: true }
//   );

//   if (!order) return res.status(400).send("the order cannot be update!");

//   res.send(order);
// });

// //UPDATE ORDER
// router.post("/updateOrder", verifyTokenAndAdmin, async (req, res) => {
//   try {
//     const order = await Order.findById(req.body.orderId);
//     if (order.status === "P") {
//       if (req.body.newStatus !== "PR" && req.body.newStatus !== "C") {
//         return res.status(400).send("INVALID REQUEST. Cannot set order to requested status");
//       }
//     } else if (order.status === "PR") {
//       if (req.body.newStatus !== "S" && req.body.newStatus !== "C") {
//         return res.status(400).send("INVALID REQUEST. Cannot set order to requested status");
//       }
//     } else if (order.status === "S") {
//       if (req.body.newStatus !== "D") {
//         return res.status(400).send("INVALID REQUEST. Cannot set order to requested status");
//       }
//     } else if (order.status === "D") {
//       if (req.body.newStatus !== "F" && req.body.newStatus !== "C") {
//         return res.status(400).send("INVALID REQUEST. Cannot set order to requested status");
//       }
//     } else {
//       return res.status(400).send("INVALID REQUEST. Cannot set order to requested status");
//     }
//     if (req.body.newStatus === "S" || req.body.newStatus === "s") {
//       await Order.findByIdAndUpdate(req.body.orderId, {
//         status: req.body.newStatus,
//         remark: req.body.remark,
//         tracking: req.body.tracker,
//       });
//     } else {
//       await Order.findByIdAndUpdate(req.body.orderId, {
//         status: req.body.newStatus,
//         remark: req.body.remark,
//       });
//     }

//     await sendOrderUpdateEmail(req.body.orderId);

//     return res.status(200).send();
//   } catch (e) {
//     return res.status(500).send();
//   }
// });

// //DELETE ORDER
// router.delete("/:id", verifyTokenAndAdmin, (req, res) => {
//   Order.findByIdAndRemove(req.params.id)
//     .then(async (order) => {
//       if (order) {
//         await order.orderItems.map(async (orderItem) => {
//           await OrderItem.findByIdAndRemove(orderItem);
//         });
//         return res.status(200).json({ success: true, message: "the order is deleted!" });
//       } else {
//         return res.status(404).json({ success: false, message: "order not found!" });
//       }
//     })
//     .catch((err) => {
//       return res.status(500).json({ success: false, error: err });
//     });
// });

// //GET USER ORDERS
// router.get(`/find/:userId`, verifyToken, async (req, res) => {
//   const userOrderList = await Order.find({ user: req.params.userId })
//     .populate({
//       path: "orderItems",
//       populate: {
//         path: "product",
//         populate: "category",
//       },
//     })
//     .sort({ dateOrdered: -1 });

//   if (!userOrderList) {
//     res.status(500).json({ success: false });
//   }
//   res.send(userOrderList);
// });

// // //GET ALL ORDERS
// router.get(`/`, verifyTokenAndAdmin, async (req, res) => {
//   const orderList = await Order.find().populate("user", "username").sort({ dateOrdered: -1 });

//   if (!orderList) {
//     res.status(500).json({ success: false });
//   }
//   res.send(orderList);
// });

// //GET SPECIFIC ORDER
// /*router.get(`/:id`, verifyTokenAndAdmin, async (req, res) => {
//     const order = await Order.findById(req.params.id)
//         .populate('user', 'username')
//         .populate({
//             path: 'orderItems',
//             populate: {
//                 path: 'product',
//                 populate: 'category'
//             }
//         });

//     if (!order) {
//         res.status(500).json({success: false});
//     }
//     res.send(order);
// });*/

// // GET MONTHLY INCOME
// router.get("/income", verifyTokenAndAdmin, async (req, res) => {
//   const product = req.query.pid;
//   const date = new Date();
//   const lastMonth = new Date(date.setMonth(date.getMonth() - 1));
//   const previousMonth = new Date(new Date().setMonth(lastMonth.getMonth() - 1));

//   try {
//     const income = await Order.aggregate([
//       {
//         $match: {
//           createdAt: { $gte: previousMonth },
//           ...(product && {
//             products: { $elemMatch: { product } },
//           }),
//         },
//       },
//       {
//         $project: {
//           month: { $month: "$createdAt" },
//           sales: "$amount",
//         },
//       },
//       {
//         $group: {
//           _id: "$month",
//           total: { $sum: "$sales" },
//         },
//       },
//     ]);
//     res.status(200).json(income);
//   } catch (err) {
//     res.status(500).json(err);
//   }
// });

// //GET THE TOTAL INCOME
// router.get("/get/total-sales", verifyTokenAndAdmin, async (req, res) => {
//   try {
//     const result = await Order.aggregate([
//       {
//         $group: {
//           _id: null,
//           totalGross: { $sum: "$grossTotal" },
//         },
//       },
//     ]);

//     const totalGross = result.length > 0 ? result[0].totalGross : 0;

//     return res.status(200).json({ success: true, totalGross });
//   } catch (error) {
//     console.error("Error fetching total gross:", error);
//     return res.status(500).json({ success: false, message: "Failed to fetch total gross." });
//   }
// });

// router.get("/get/sales-summary", verifyTokenAndAdmin, async (req, res) => {
//   try {
//     const currentYear = new Date().getFullYear();
//     const startYear = currentYear - 4; // Past 5 years including the current year

//     const summary = await Order.aggregate([
//       // Step 1: Match only orders from the past 5 years
//       {
//         $match: {
//           date: {
//             $gte: new Date(`${startYear}-01-01`), // Start from January 1st of the 5th year back
//             $lte: new Date(`${currentYear}-12-31`), // Until the end of the current year
//           },
//         },
//       },
//       // Step 2: Project the year and month from the `date` field
//       {
//         $project: {
//           year: { $year: "$date" },
//           month: { $month: "$date" },
//           grossTotal: 1,
//         },
//       },
//       // Step 3: Group by year and month, summing the grossTotal
//       {
//         $group: {
//           _id: { year: "$year", month: "$month" },
//           totalGrossTotal: { $sum: "$grossTotal" },
//         },
//       },
//       // Step 4: Group by year to prepare for array format
//       {
//         $group: {
//           _id: "$_id.year",
//           monthlyTotals: {
//             $push: { month: "$_id.month", total: "$totalGrossTotal" },
//           },
//         },
//       },
//       // Step 5: Project the results into the desired array format
//       {
//         $project: {
//           year: "$_id",
//           data: {
//             $map: {
//               input: { $range: [1, 13] }, // Loop through months 1 to 12
//               as: "month",
//               in: {
//                 $let: {
//                   vars: {
//                     matchingMonth: {
//                       $arrayElemAt: [
//                         {
//                           $filter: {
//                             input: "$monthlyTotals",
//                             as: "m",
//                             cond: { $eq: ["$$m.month", "$$month"] },
//                           },
//                         },
//                         0,
//                       ],
//                     },
//                   },
//                   in: { $ifNull: ["$$matchingMonth.total", 0] },
//                 },
//               },
//             },
//           },
//         },
//       },
//       // Step 6: Sort the final result by year (optional)
//       {
//         $sort: { year: 1 },
//       },
//     ]);
//     // .then((result) => {
//     //   console.log(result);
//     //   return res.status(200).json({ success: true, summary: result });
//     // })
//     // .catch((err) => {
//     //   console.error(err);
//     //   return res.status(500).json({ success: false, message: "Failed to fetch total gross." });
//     // });
//     return res.status(200).json(summary);
//   } catch (error) {
//     console.error("Error fetching total gross:", error);
//     return res.status(500).json({ success: false, message: "Failed to fetch total gross." });
//   }
// });

// router.get("/get/total-income", verifyTokenAndAdmin, async (req, res) => {
//   try {
//     const result = await Order.aggregate([
//       {
//         $group: {
//           _id: null,
//           totalIncome: { $sum: "$subTotal" },
//         },
//       },
//     ]);

//     const totalIncome = result.length > 0 ? result[0].totalIncome : 0;

//     return res.status(200).json({ success: true, totalIncome });
//   } catch (error) {
//     console.error("Error fetching total subTotal:", error);
//     return res.status(500).json({ success: false, message: "Failed to fetch total subTotal." });
//   }
// });

// //GET THE TOTAL ORDER COUNT
// router.get(`/get/count`, verifyTokenAndAdmin, async (req, res) => {
//   const orderCount = await Order.countDocuments();

//   if (!orderCount) {
//     return res.status(500).json({ success: false });
//   }
//   return res.send({ orderCount: orderCount });
// });

// //GET ALL ORDERS
// router.get(`/getAllOrders`, verifyTokenAndAdmin, async (req, res) => {
//   const order = await Order.find({})
//     .populate("address")
//     .populate("orderItems.itemId", { _id: 1, name: 1, price: 1, discountedPrice: 1, image: 1 });
//   return res.send(order);
// });

// router.get("/getLatestOrder", verifyTokenAndAdmin, async (req, res) => {
//   try {
//     const latestOrder = await Order.find({})
//       .sort({ createdAt: -1 }) // Sort by createdAt in descending order to get the latest order
//       .limit(1) // Limit the result to only the latest order
//       .populate("address")
//       .populate("orderItems.itemId", { _id: 1, name: 1, price: 1, discountedPrice: 1, image: 1 });

//     return res.send(latestOrder);
//   } catch (error) {
//     return res.status(500).send({ error: "An error occurred while fetching the latest order." });
//   }
// });

// /* router.post(`/placeOrder`, auth0Verify, async (req, res) => {
//     try {
//         let cart = await Cart.find({ username: req.body.email }).populate('product',
//             { _id : 1, name: 1, price: 1, discountedPrice: 1, variations: 1, isNumericVariation: 1 });
//         let cartArray = [];
//         for (let item of cart) {
//             let cartItem = item.toJSON();
//             if (item.product.isNumericVariation) {
//                 let flag = false;
//                 for (let variation of item.product.variations) {
//                     for (let varItem of variation.innerVariations) {
//                         if (variation.color === item.color && varItem.size === parseInt(item.size)) {
//                             cartItem.stockSize = variation.quantity;
//                             cartItem.varPrice = varItem.price;
//                             cartItem.varDiscountedPrice = varItem.discountedPrice;
//                             cartItem.varWeight = varItem.weight;
//                             flag = true;
//                             break;
//                         }
//                     }
//                     if (flag) {
//                         break;
//                     }
//                 }
//             } else {
//                 for (let variation of item.product.variations) {
//                     if (variation.color === item.color && variation.size === item.size) {
//                         cartItem.stockSize = variation.quantity
//                         cartItem.varPrice = variation.price;
//                         cartItem.varDiscountedPrice = variation.discountedPrice;
//                         cartItem.varWeight = variation.weight;
//                         break
//                     }
//                 }
//             }
//             cartArray.push(cartItem);
//         }

//         let itemsInCart = []
//         for (let item of cartArray) {
//             item.neededTot = 0
//             let cartItem = null
//             for (let car of itemsInCart) {
//                 if (!!item.product.isNumericVariation && !!car.isNumericVariation) {
//                     if (car.itemId === item.product._id.toString() && car.itemColor === item.color) {
//                         item.neededTot += ((car.itemQuantity * car.itemSize) + (item.quantity * item.size))
//                         if (item.neededTot > item.stockSize) {
//                             return res.status(200).json(
//                                 {success: false, message: "Only " + item.stockSize +
//                                         ((!!item.product.isNumericVariation) ? ' meters' : ' items') + " in stock from " + item.product.name });
//                         }
//                     }
//                 }
//                 if (car.itemId === item.product._id.toString() && car.itemSize===item.size && car.itemColor===item.color) {
//                     cartItem = car
//                     let neededTot;
//                     if (!!item.product.isNumericVariation) {
//                         neededTot = ((car.itemQuantity + item.quantity) * item.size)
//                     } else {
//                         neededTot = (car.itemQuantity + item.quantity)
//                     }
//                     if (item.stockSize < neededTot) {
//                         return res.status(200).json(
//                             {success: false, message: "Only " + item.stockSize +
//                                     ((!!item.product.isNumericVariation) ? ' meters' : ' items') + " in stock from " + item.product.name });
//                     }
//                     car.itemQuantity += item.quantity
//                 }
//             }
//             if (!cartItem) {
//                 cartItem = {
//                     itemId: item.product._id.toString(),
//                     itemSize: item.size,
//                     itemColor: item.color,
//                     itemQuantity: item.quantity,
//                     isNumericVariation: item.product.isNumericVariation,
//                     itemPrice: item.varPrice,
//                     itemDiscountedPrice: item.varDiscountedPrice,
//                     itemWeight: item.varWeight
//                 }
//                 let neededTot;
//                 if (!!item.product.isNumericVariation) {
//                     neededTot = (item.quantity * item.size)
//                 } else {
//                     neededTot = item.quantity
//                 }
//                 if (item.stockSize < neededTot) {
//                     return res.status(200).json(
//                         {success: false, message: "Only " + item.stockSize +
//                                 ((!!item.product.isNumericVariation) ? ' meters' : ' items') + " in stock from " + item.product.name });
//                 }
//                 itemsInCart.push(cartItem);
//             }
//         }

//         let rawTot = 0;
//         let totDiscounts = 0;
//         let totWeight = 0;
//         let finalShipping = 0;
//         for (let car of itemsInCart) {
//             rawTot += (car.itemPrice * car.itemQuantity)
//             if (car.itemDiscountedPrice) {
//                 totDiscounts += ((car.itemPrice - car.itemDiscountedPrice) * car.itemQuantity)
//             }
//             totWeight += (car.itemWeight * car.itemQuantity)
//         }
//         const address = await ClientAddress.findById(req.body.address);
//         let finalShippingObj = await calculateShipping(totWeight, address.country);
//         if (req.body.delivery === 'standard' || req.body.delivery === 'premium') {
//             finalShipping = finalShippingObj.normalPrice
//         } else {
//             finalShipping = finalShippingObj.expensivePrice
//         }

//         let order = new Order({
//             username: req.body.email,
//             address: req.body.address,
//             delivery: req.body.delivery,
//             orderItems: itemsInCart,
//             rawTotal: rawTot,
//             discounts: totDiscounts,
//             totalWeight: totWeight,
//             shipping: finalShipping,
//         })
//         await order.save();
//         await Product.bulkWrite(
//             itemsInCart.map((data) => {
//                 if (!!data.isNumericVariation) {
//                     return ({
//                         updateOne: {
//                             filter: {
//                                 "_id": data.itemId,
//                                 "variations.color": data.itemColor,
//                                 "variations.innerVariations.size": data.itemSize
//                             },
//                             update: {$inc: {"variations.$.quantity": ((parseInt(data.itemSize) * data.itemQuantity) * -1), purchaseCount: 1}}
//                         }
//                     })
//                 } else {
//                     return ({
//                         updateOne: {
//                             filter: {
//                                 "_id": data.itemId,
//                                 "variations.color": data.itemColor,
//                                 "variations.size": data.itemSize
//                             },
//                             update: {$inc: {"variations.$.quantity": (data.itemQuantity * -1), purchaseCount: 1}}
//                         }
//                     })
//                 }
//             }
//             ))
//         await Cart.deleteMany({username: req.body.email});
//         sendOrderPlacedEmail(order._id);
//         return res.status(200).json({success: true});
//     } catch (e) {
//         console.error(e)
//         return res.status(500).json({success: false});
//     }
// }); */

// //GET ORDERS FOR USER
// router.post(`/getOrdersForUser`, auth0Verify, async (req, res) => {
//   const order = await Order.find({ username: req.body.username })
//     .populate("address")
//     .populate("orderItems.itemId", { _id: 1, name: 1, price: 1, discountedPrice: 1, image: 1 });
//   return res.send(order);
// });

// router.get("/getPaymentPage", async (req, res) => {
//   const username = req.query.username;
//   const address = req.query.address;
//   const delivery = req.query.delivery;

//   res.render("paymentPage", { username, delivery, address, accessToken: process.env.CLOVER_TOKEN });
// });

// router.post("/charge", auth0Verify, async (req, res) => {
//   const username = req.body.username;

//   const currency = "cad"; // TODO IMPORTANT: CHANGE CURRENCY TO CAD ON PRODUCTION
//   const cToken = req.body.cToken;

//   let cart = await Cart.find({ username: username }).populate("product", {
//     _id: 1,
//     name: 1,
//     price: 1,
//     discountedPrice: 1,
//     image: 1,
//     imageAlt: 1,
//     description: 1,
//     variations: 1,
//     isNumericVariation: 1,
//   });

//   if (!cart || cart.length === 0) {
//     return res.status(500).json({ success: false, message: "Cart cannot be empty when charging" });
//   }

//   // Subtotal before taxes or shipping
//   let tempSubTotal = 0;

//   let cartArray = [];
//   // let tempPrice = null;
//   // let tempDiscountedPrice = null;

//   for (let item of cart) {
//     let cartItem = item.toJSON();

//     if (item.product && item.product.variations) {
//       for (let variation of item.product.variations) {
//         cartItem.stockSize = variation.quantity;
//         cartItem.price = variation.price;
//         cartItem.discountedPrice = variation.discountedPrice;
//         break;
//       }
//     } else {
//       cartItem.stockSize = null;
//       cartItem.price = null;
//       cartItem.discountedPrice = null;
//     }

//     if (!!cartItem.discountedPrice) tempSubTotal += cartItem.discountedPrice;
//     else if (cartItem.price) tempSubTotal += cartItem.price;

//     // item.product.price = tempPrice;
//     // item.product.discountedPrice = tempDiscountedPrice;
//     cartArray.push(cartItem);
//   }

//   if (tempSubTotal <= 0) {
//     return res.status(500).json({ success: false, message: "Total amount of cart cannot be zero" });
//   }

//   // Shipping amount
//   const shipping = tempSubTotal > 100 ? 0 : 10;

//   const tempTotal = tempSubTotal + shipping;

//   const taxes = await Tax.find({ isActive: true });

//   const taxAmount = taxes.reduce((total, currentTax) => {
//     return total + (tempTotal / 100) * currentTax.percentage;
//   }, 0);

//   const options = {
//     method: "POST",
//     url: "https://scl-sandbox.dev.clover.com/v1/charges",
//     headers: {
//       accept: "application/json",
//       "content-type": "application/json",
//       authorization: `Bearer ${process.env.CLOVER_SECRET}`,
//     },
//     body: {
//       ecomind: "ecom",
//       metadata: { existingDebtIndicator: false },
//       amount: (tempSubTotal + taxAmount + shipping) * 100,
//       currency: currency,
//       source: cToken,
//     },
//     json: true,
//   };

//   request(options, async function (error, response, body) {
//     if (error) {
//       return res.status(500).json({ success: false, message: "Error occurred" });
//     }

//     if (body && body.status != undefined && body.status === "succeeded") {
//       try {
//         let cart = await Cart.find({ username: username }).populate({
//           path: "product",
//           select: "_id name isNumericVariation variations",
//         });

//         let cartArray = [];
//         for (let item of cart) {
//           let cartItem = item.toJSON();

//           // Find the specific variation using the variation ID manually
//           let variation = cartItem.product.variations.find(
//             (v) => v._id.toString() === item.variation.toString()
//           );
//           if (!variation) {
//             return res.status(400).json({
//               success: false,
//               message: `Variation with ID ${item.variation} not found for product ${item.product._id}`,
//             });
//           }

//           cartItem.stockSize = variation.quantity;
//           cartItem.varPrice = variation.price;
//           cartItem.varDiscountedPrice = variation.discountedPrice;
//           cartItem.varWeight = variation.weight;
//           cartItem.variationName = variation.name; // Add this line to include the variation name

//           cartArray.push(cartItem);
//         }

//         console.log(cartArray);

//         let itemsInCart = [];
//         for (let item of cartArray) {
//           let cartItem = null;

//           // Check if the item already exists in the itemsInCart array
//           for (let car of itemsInCart) {
//             if (
//               car.itemId === item.product._id.toString() &&
//               car.variationId === item.variation.toString()
//             ) {
//               cartItem = car;
//               let neededTot = car.itemQuantity + item.quantity;

//               if (item.stockSize < neededTot) {
//                 return res.status(200).json({
//                   success: false,
//                   message: `Only ${item.stockSize} ${
//                     item.product.isNumericVariation ? "meters" : "items"
//                   } in stock for ${item.product.name}`,
//                 });
//               }

//               car.itemQuantity += item.quantity;
//               break;
//             }
//           }

//           if (!cartItem) {
//             cartItem = {
//               itemId: item.product._id.toString(),
//               variationId: item.variation.toString(),
//               variationName: item.variationName, // Include the variation name here
//               itemQuantity: item.quantity,
//               isNumericVariation: item.product.isNumericVariation,
//               itemPrice: item.varPrice,
//               itemDiscountedPrice: item.varDiscountedPrice,
//               itemWeight: item.varWeight,
//             };

//             let neededTot = item.quantity;

//             if (item.stockSize < neededTot) {
//               return res.status(200).json({
//                 success: false,
//                 message: `Only ${item.stockSize} ${
//                   item.product.isNumericVariation ? "meters" : "items"
//                 } in stock for ${item.product.name}`,
//               });
//             }

//             itemsInCart.push(cartItem);
//           }
//         }

//         let rawTot = 0;
//         let totDiscounts = 0;
//         let totWeight = 0;

//         for (let car of itemsInCart) {
//           rawTot += car.itemPrice * car.itemQuantity;

//           if (car.itemDiscountedPrice) {
//             totDiscounts += (car.itemPrice - car.itemDiscountedPrice) * car.itemQuantity;
//           }

//           totWeight += car.itemWeight * car.itemQuantity;
//         }

//         let grossTax = taxes.reduce((total, currentTax) => {
//           return total + (tempSubTotal / 100) * currentTax.percentage;
//         }, 0);

//         let grossTotal = tempSubTotal + shipping + grossTax;

//         let grossSubtotal = rawTot - totDiscounts;

//         // const address = await ClientAddress.find({ email: username });
//         console.log(itemsInCart);

//         // Create a new order
//         let order = new Order({
//           username: username,
//           address: req.body.address,
//           delivery: "standard",
//           orderItems: itemsInCart,
//           rawTotal: rawTot,
//           discounts: totDiscounts,
//           subTotal: grossSubtotal,
//           grossTax: grossTax, // Save the grossTax
//           grossTotal: grossTotal, // Save the grossTotal
//           // totalWeight: totWeight,
//           taxes: taxes.map((tax) => {
//             return {
//               taxId: tax._id,
//               taxname: tax.taxname,
//               percentage: tax.percentage,
//               amount: (tempTotal / 100) * tax.percentage,
//             };
//           }),
//           shipping: shipping,
//         });

//         await order.save();

//         // Update the product quantities and purchase counts for the variations
//         for (let data of itemsInCart) {
//           await Product.updateOne(
//             { _id: data.itemId, "variations._id": data.variationId },
//             {
//               $inc: {
//                 "variations.$.quantity": data.itemQuantity * -1,
//                 purchaseCount: 1,
//               },
//             }
//           );
//         }

//         // Clear the cart for the user
//         await Cart.deleteMany({ username: username });

//         // Send order placed email
//         sendOrderPlacedEmail(order._id);

//         // Return the order object in the response
//         return res.status(200).json({ success: true, order: order._id });
//       } catch (e) {
//         console.error(e);
//         return res
//           .status(500)
//           .json({ success: false, message: "An error occurred while placing the order." });
//       }
//     }
//     // return res.status(200).json({ success: true });
//     else
//       return res
//         .status(500)
//         .json({ success: false, message: body.error?.message || "Error occurred" });
//   });
// });

// // router.post(`/placeOrder`, auth0Verify, async (req, res) => {
// //   try {
// //     let cart = await Cart.find({ username: req.body.email }).populate({
// //       path: "product",
// //       select: "_id name isNumericVariation variations",
// //     });

// //     let cartArray = [];
// //     for (let item of cart) {
// //       let cartItem = item.toJSON();

// //       // Find the specific variation using the variation ID manually
// //       let variation = cartItem.product.variations.find(
// //         (v) => v._id.toString() === item.variation.toString()
// //       );
// //       if (!variation) {
// //         return res.status(400).json({
// //           success: false,
// //           message: `Variation with ID ${item.variation} not found for product ${item.product._id}`,
// //         });
// //       }

// //       cartItem.stockSize = variation.quantity;
// //       cartItem.varPrice = variation.price;
// //       cartItem.varDiscountedPrice = variation.discountedPrice;
// //       cartItem.varWeight = variation.weight;
// //       cartItem.variationName = variation.name; // Add this line to include the variation name

// //       cartArray.push(cartItem);
// //     }

// //     let itemsInCart = [];
// //     for (let item of cartArray) {
// //       let cartItem = null;

// //       // Check if the item already exists in the itemsInCart array
// //       for (let car of itemsInCart) {
// //         if (
// //           car.itemId === item.product._id.toString() &&
// //           car.variationId === item.variation.toString()
// //         ) {
// //           cartItem = car;
// //           let neededTot = car.itemQuantity + item.quantity;

// //           if (item.stockSize < neededTot) {
// //             return res.status(200).json({
// //               success: false,
// //               message: `Only ${item.stockSize} ${
// //                 item.product.isNumericVariation ? "meters" : "items"
// //               } in stock for ${item.product.name}`,
// //             });
// //           }

// //           car.itemQuantity += item.quantity;
// //           break;
// //         }
// //       }

// //       if (!cartItem) {
// //         cartItem = {
// //           itemId: item.product._id.toString(),
// //           variationId: item.variation.toString(),
// //           variationName: item.variationName, // Include the variation name here
// //           itemQuantity: item.quantity,
// //           isNumericVariation: item.product.isNumericVariation,
// //           itemPrice: item.varPrice,
// //           itemDiscountedPrice: item.varDiscountedPrice,
// //           itemWeight: item.varWeight,
// //         };

// //         let neededTot = item.quantity;

// //         if (item.stockSize < neededTot) {
// //           return res.status(200).json({
// //             success: false,
// //             message: `Only ${item.stockSize} ${
// //               item.product.isNumericVariation ? "meters" : "items"
// //             } in stock for ${item.product.name}`,
// //           });
// //         }

// //         itemsInCart.push(cartItem);
// //       }
// //     }

// //     let rawTot = 0;
// //     let totDiscounts = 0;
// //     let totWeight = 0;
// //     let finalShipping = 0;

// //     for (let car of itemsInCart) {
// //       rawTot += car.itemPrice * car.itemQuantity;

// //       if (car.itemDiscountedPrice) {
// //         totDiscounts += (car.itemPrice - car.itemDiscountedPrice) * car.itemQuantity;
// //       }

// //       totWeight += car.itemWeight * car.itemQuantity;
// //     }

// //     const address = await ClientAddress.findById(req.body.address);

// //     // Create a new order
// //     let order = new Order({
// //       username: req.body.email,
// //       address: req.body.address,
// //       delivery: req.body.delivery,
// //       orderItems: itemsInCart,
// //       rawTotal: rawTot,
// //       discounts: totDiscounts,
// //       totalWeight: totWeight,
// //       shipping: finalShipping,
// //     });

// //     await order.save();

// //     // Update the product quantities and purchase counts for the variations
// //     for (let data of itemsInCart) {
// //       await Product.updateOne(
// //         { _id: data.itemId, "variations._id": data.variationId },
// //         {
// //           $inc: {
// //             "variations.$.quantity": data.itemQuantity * -1,
// //             purchaseCount: 1,
// //           },
// //         }
// //       );
// //     }

// //     // Clear the cart for the user
// //     await Cart.deleteMany({ username: req.body.email });

// //     // Send order placed email
// //     sendOrderPlacedEmail(order._id);

// //     // Return the order object in the response
// //     return res.status(200).json({ success: true });
// //   } catch (e) {
// //     console.error(e);
// //     return res
// //       .status(500)
// //       .json({ success: false, message: "An error occurred while placing the order." });
// //   }
// // });

// //Calculate postal charge
// router.post(`/findPostalCharges`, async (req, res) => {
//   try {
//     let cart = await Cart.find({ username: req.body.email }).populate("product", {
//       _id: 1,
//       variations: 1,
//       isNumericVariation: 1,
//     });
//     let totWeight = 0;
//     for (let item of cart) {
//       if (!!item.product.isNumericVariation) {
//         for (let variation of item.product.variations) {
//           for (let innerVar of variation.innerVariations) {
//             if (variation.color === item.color && innerVar.size === parseInt(item.size)) {
//               totWeight += item.quantity * innerVar.weight;
//               break;
//             }
//           }
//         }
//       } else {
//         for (let variation of item.product.variations) {
//           if (variation.color === item.color && variation.size === item.size) {
//             totWeight += item.quantity * variation.weight;
//             break;
//           }
//         }
//       }
//     }
//     // const dataObj = await calculateShipping(totWeight, req.body.country);
//     const dataObj = { normalPrice: 10.0, expensivePrice: 15.0 };
//     return res.send(dataObj);
//   } catch (e) {
//     console.error(e);
//     return res.status(500).json({ success: false });
//   }
// });

// router.post(`/printReportForUser`, auth0Verify, async (req, res) => {
//   try {
//     let data = await generateAndDownloadReport(req, res);
//     return res.status(200).json({ dataStr: data.toString() });
//   } catch (e) {
//     console.error(e);
//     return res.status(500).json({ success: false });
//   }
// });

// router.post(`/printReportForAdmin`, verifyTokenAndAdmin, async (req, res) => {
//   try {
//     let data = await generateAndDownloadReport(req, res);
//     return res.status(200).json({ dataStr: data.toString() });
//   } catch (e) {
//     console.error(e);
//     return res.status(500).json({ success: false });
//   }
// });

// function addWrappedText({ text, textWidth, doc, initialYPosition = 10 }) {
//   text += ",";
//   let textLines = doc.splitTextToSize(text, textWidth); // Split the text into lines
//   let pageHeight = doc.internal.pageSize.height; // Get page height, well use this for auto-paging

//   let cursorY = initialYPosition;

//   textLines.forEach((lineText) => {
//     if (cursorY > pageHeight) {
//       // Auto-paging
//       doc.addPage();
//       cursorY = 10;
//     }
//     doc.text(10, cursorY, lineText);
//     cursorY += 10;
//   });
//   return cursorY;
// }

// router.post(`/printAddressForAdmin`, verifyTokenAndAdmin, async (req, res) => {
//   try {
//     const { jsPDF } = require("jspdf");
//     const order = await Order.findById(req.body.orderId).populate("address");
//     let fileName = order._id + "address.pdf";
//     const doc = new jsPDF({
//       compress: true,
//       orientation: "landscape",
//     });
//     let address = order.address;
//     let initialYPosition = 10;
//     initialYPosition = addWrappedText({
//       text: address.name,
//       textWidth: 220,
//       doc,
//       initialYPosition: initialYPosition,
//     });
//     initialYPosition = addWrappedText({
//       text: address.number,
//       textWidth: 220,
//       doc,
//       initialYPosition: initialYPosition,
//     });
//     initialYPosition = addWrappedText({
//       text: address.address,
//       textWidth: 220,
//       doc,
//       initialYPosition: initialYPosition,
//     });
//     initialYPosition = addWrappedText({
//       text: address.town,
//       textWidth: 220,
//       doc,
//       initialYPosition: initialYPosition,
//     });
//     initialYPosition = addWrappedText({
//       text: address.state,
//       textWidth: 220,
//       doc,
//       initialYPosition: initialYPosition,
//     });
//     initialYPosition = addWrappedText({
//       text: countryList().getLabel(address.country),
//       textWidth: 220,
//       doc,
//       initialYPosition: initialYPosition,
//     });
//     initialYPosition = addWrappedText({
//       text: address.postalCode,
//       textWidth: 220,
//       doc,
//       initialYPosition: initialYPosition,
//     });
//     let data = doc.output("datauristring", { filename: fileName });
//     return res.status(200).json({ dataStr: data.toString() });
//     /*let fs = require('fs'),
//             path = require('path'),
//             filePath = path.join(__dirname, '../report/generated_reports/'+fileName);
//         fs.readFile(filePath, {encoding: 'utf-8'}, function(err,data){
//             if (!err) {
//                 const fileNameTemp = 'order-address.pdf'
//                 const stream = fs.createReadStream(filePath);
//                 res.set({
//                     'Content-Disposition': `attachment; filename='${fileNameTemp}'`,
//                     'Content-Type': 'application/pdf',
//                 });
//                 stream.pipe(res);
//                 fs.unlink(filePath, (err) => {
//                     if (err) {
//                         console.error(err);
//                     }
//                 });
//             } else {
//                 console.log(err);
//                 return res.status(500).json({success: false});
//             }
//         });*/
//   } catch (e) {
//     console.error(e);
//     return res.status(500).json({ success: false });
//   }
// });

// async function generateAndDownloadReport(req, res) {
//   try {
//     const order = await Order.findById(req.body.orderId)
//       .populate("address")
//       .populate("orderItems.itemId", { _id: 1, name: 1, isNumericVariation: 1 });
//     let fileName = req.body.orderId + ".pdf";
//     let data = generateReport(fileName, order);
//     return data.dataUriString;
//     /*let fs = require('fs'),
//             path = require('path'),
//             filePath = path.join(__dirname, '../report/generated_reports/'+fileName);
//         fs.readFile(filePath, {encoding: 'utf-8'}, function(err,data){
//             if (!err) {
//                 const fileNameTemp = 'order-invoice.pdf'
//                 const stream = fs.createReadStream(filePath);
//                 res.set({
//                     'Content-Disposition': `attachment; filename='${fileNameTemp}'`,
//                     'Content-Type': 'application/pdf',
//                 });
//                 stream.pipe(res);
//                 fs.unlink(filePath, (err) => {
//                     if (err) {
//                         console.error(err);
//                     }
//                 });
//             } else {
//                 console.log(err);
//                 return res.status(500).json({success: false});
//             }
//         });*/
//   } catch (e) {
//     console.error(e);
//     return res.status(500).json({ success: false });
//   }
// }

// async function calculateShipping(weight, countryCode) {
//   let shippingPrices;
//   shippingPrices = await ShippingPrice.findOne({ countries: { $in: countryCode } });
//   if (shippingPrices == null) {
//     shippingPrices = await ShippingPrice.findOne({ countries: { $in: "*" } });
//   }
//   weight = weight / 1000;
//   let curRange = null;
//   let largestRange = null;
//   for (let priceRange of shippingPrices.priceVariations) {
//     if (weight < priceRange.weight) {
//       if (!curRange && weight < priceRange.weight) {
//         curRange = priceRange;
//       } else if (curRange && curRange.weight > priceRange.weight) {
//         curRange = priceRange;
//       }
//       if (!largestRange) {
//         largestRange = priceRange;
//       } else if (largestRange.weight < priceRange.weight) {
//         largestRange = priceRange;
//       }
//     }
//   }
//   if (!curRange) {
//     curRange = largestRange;
//   }
//   return { normalPrice: curRange.regularPrice, expensivePrice: curRange.premiumPrice };
// }

// module.exports = router;
