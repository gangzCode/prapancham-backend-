const express = require("express");
const router = express.Router();
const { ObituaryRemembarancePackages } = require("../models/obituaryRemembarance-packages");
const { verifyTokenAndAuthorization,verifyTokenAndAdmin } = require("./verifyToken");
const { Addons } = require("../models/addons");
const { Order } = require("../models/order");
const { User } = require("../models/user");
const { TributeItem } = require("../models/tributeItems");
const { Country } = require("../models/country");
const { Donation } = require("../models/donation");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const multer = require("multer");
const multerS3 = require("multer-s3");
const aws = require("aws-sdk");
const uuid = require("uuid");
const { S3Client } = require("@aws-sdk/client-s3");
const { sendOrderPlacedEmail,sendOrderUpdateEmail } = require("../report/nodemailer");
const axios = require("axios");
const Stripe = require("stripe");


dotenv.config();

aws.config.update({
  secretAccessKey: process.env.SPACE_ACCESSKEYSECRET,
  accessKeyId: process.env.SPACE_ACCESSKEYID,
  region: process.env.SPACE_REGION,
});

const s3 = new S3Client({
  //endpoint: process.env.SPACE_ENDPOINT,
  region: process.env.SPACE_REGION,
  credentials: {
    accessKeyId: process.env.SPACE_ACCESSKEYID,
    secretAccessKey: process.env.SPACE_ACCESSKEYSECRET,
  },
});

const uploadAWS = (orderId) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${orderId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
});

router.post("/", verifyTokenAndAuthorization, async (req, res) => {
  let orderId;

  try {
    let order = new Order({ username: "" });
    order = await order.save({ validateBeforeSave: false });
    orderId = order._id.toString();

    // Setup AWS upload fields
    uploadAWS(orderId).fields([
      { name: "primaryImage", maxCount: 1 },
      { name: "thumbnailImage", maxCount: 1 },
      { name: "additionalImages", maxCount: 10 },
      { name: "slideshowImages", maxCount: 100 }
    ])(req, res, async (err) => {
      if (err) {
        await Order.findByIdAndDelete(orderId);
        return res.status(500).send("Image upload failed");
      }

      req.body = sanitizeBodyKeys(req.body);

      try {
        const updatedOrder = await updateOrder(orderId, req.body, req.files);
        if (!updatedOrder) {
          await Order.findByIdAndDelete(orderId);
          return res.status(500).send("Order update failed");
        }

        res.send(updatedOrder);
      } catch (updateErr) {
        await Order.findByIdAndDelete(orderId);
        return res.status(500).send(updateErr.message || "Order update error");
      }
    });

  } catch (e) {
    if (orderId) {
      await Order.findByIdAndDelete(orderId);
    }
    return res.status(500).send("Failed to create order");
  }
});

router.post("/update", verifyTokenAndAdmin, async (req, res) => {
    try {
      await uploadAWS(req.body.orderId).fields([
        { name: "primaryImage", maxCount: 1 },
        { name: "thumbnailImage", maxCount: 1 },
        { name: "additionalImages", maxCount: 10 },
        { name: "slideshowImages", maxCount: 10 }
      ])(req, res, async (err) => {
        if (err) {
          return res.status(500).send("The order cannot be updated");
        }
  
        const event = await editOrder(req.body.orderId, req.body, req.files);
        if (!event) {
          return res.status(500).send("The order cannot be updated");
        }
  
        res.send(event);
      });
    } catch (e) {
      return res.status(500).send("The order cannot be updated");
    }
});

router.get("/priority", async (req, res) => {
  try {
    const priorityOrders = await Order.find({ isDeleted: false, orderStatus:'Post Approved' })
      .populate({
        path: "selectedPackage",
        match: { isPriority: true },
        model: "ObituaryRemembarancePackages",
      })
      .sort({ createdAt: -1 });

    const filteredOrders = priorityOrders.filter(order => order.selectedPackage !== null);

    res.status(200).json({ orders: filteredOrders });
  } catch (err) {
    console.error("Error fetching priority orders:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/active-sorted", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const orders = await Order.find({ isDeleted: false, orderStatus:'Post Approved' })
      .populate("selectedPackage", "isPriority isFeature") 
      .populate("selectedBgColor")
      .populate("selectedPrimaryImageBgFrame")
      .sort({ createdAt: -1 });

    const sortedOrders = orders.sort((a, b) => {
      const aPriority = a.selectedPackage?.isPriority ? 1 : 0;
      const bPriority = b.selectedPackage?.isPriority ? 1 : 0;
      const aFeature = a.selectedPackage?.isFeature ? 1 : 0;
      const bFeature = b.selectedPackage?.isFeature ? 1 : 0;

      if (bPriority !== aPriority) return bPriority - aPriority;
      if (bFeature !== aFeature) return bFeature - aFeature;
      return 0;
    });

    const paginatedOrders = sortedOrders.slice(skip, skip + limit);

    res.status(200).json({
      orders: paginatedOrders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(sortedOrders.length / limit),
        totalItems: sortedOrders.length,
      },
    });
  } catch (err) {
    console.error("Error fetching sorted priority orders:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/all", verifyTokenAndAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
  
      const orders = await Order.find({ isDeleted: false })
      .populate("selectedPackage")
      .populate("selectedBgColor")
      .populate("selectedAddons")
      .populate({
        path: "finalPrice.country",
        select: "currencyCode",
      })
      .populate("selectedPrimaryImageBgFrame")
      .populate("recievedDonations")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const total = await Order.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        orders,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.get(`/find/:userId`, verifyTokenAndAuthorization, async (req, res) => {
  try {
    const { type } = req.query;

    if (!["obituary", "remembrance"].includes(type)) {
      return res.status(400).json({
        message: "Query parameter 'type' must be either 'obituary' or 'remembrance'.",
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const orders = await Order.find({ username: user.username, isDeleted: false })
      .populate({
        path: "selectedPackage",
        model: "ObituaryRemembarancePackages",
      })
      .populate("selectedBgColor")
      .populate("selectedAddons")
      .populate({
        path: "finalPrice.country",
        select: "currencyCode",
      })
      .populate({
        path: "basePackagePrice.country",
        select: "currencyCode",
      })
      .populate("selectedPrimaryImageBgFrame")
      .sort({ dateOrdered: -1 });

    let filteredOrders;
    if (type === "obituary") {
      filteredOrders = orders.filter(order => order.selectedPackage?.isObituary === true);
    } else {
      filteredOrders = orders.filter(order => order.selectedPackage?.isRemembrance === true);
    }

    if (filteredOrders.length === 0) {
      return res.status(404).json({ message: `No ${type} orders found.` });
    }

    res.status(200).json({
      type,
      count: filteredOrders.length,
      orders: filteredOrders,
    });
  } catch (err) {
    console.error("Error fetching orders by type:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/country-order-count", async (req, res) => {
  try {
    const countries = await Country.find({}, "_id name image currencyCode");

    const orderCounts = await Order.aggregate([
      {
        $match: {
          isDeleted: false,
          orderStatus: "Post Approved"
        }
      },
      {
        $group: {
          _id: "$finalPrice.country",
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = {};
    orderCounts.forEach(item => {
      countMap[item._id?.toString()] = item.count;
    });

    const countryWithOrderCounts = countries.map(country => {
      return {
        _id: country._id,
        name: country.name,
        currencyCode: country.currencyCode,
        image: country.image,
        orderCount: countMap[country._id.toString()] || 0
      };
    });

    res.status(200).json(countryWithOrderCounts);
  } catch (err) {
    console.error("Error fetching country order counts:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get('/by-selected-country/:countryId', async (req, res) => {
  const { countryId } = req.params;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  if (!mongoose.isValidObjectId(countryId)) {
    return res.status(400).send("Invalid country ID");
  }

  try {
    const filter = {
      orderStatus: "Post Approved",
      selectedCountry: countryId,
      isDeleted: false,
    };

    const [orders, totalCount] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return res.status(200).json({
      orders,
      pagination: {
        totalItems: totalCount,
        currentPage: page,
        totalPages,
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    return res.status(500).send("Internal server error");
  }
});

router.post('/search', async (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).send("Title is required");
  }

  try {
    const orders = await Order.find({
      orderStatus: "Post Approved",
      "information.title": { $regex: title, $options: "i" } // case-insensitive
    });

    if (!orders.length) {
      return res.status(404).send("No matching orders found");
    }

    res.status(200).json(orders);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post('/filter', async (req, res) => {
  try {
    const {
      isPriority,
      isRemembarace,
      isObituary,
      isFeatured,
      page = 1,
      limit = 10
    } = req.body;

    const matchQuery = {
      orderStatus: "Post Approved",
      isDeleted: false
    };

    const lookupPipeline = [
      {
        $lookup: {
          from: 'obituaryremembarancepackages',
          localField: 'selectedPackage',
          foreignField: '_id',
          as: 'packageDetails'
        }
      },
      { $unwind: '$packageDetails' }
    ];

    const matchFlags = [];

    if (isPriority !== undefined) {
      matchFlags.push({
        $expr: {
          $eq: [
            { $ifNull: ["$packageDetails.isPriority", false] },
            isPriority
          ]
        }
      });
    }

    if (isRemembarace !== undefined) {
      matchFlags.push({
        $expr: {
          $eq: [
            { $ifNull: ["$packageDetails.isRemembarace", false] },
            isRemembarace
          ]
        }
      });
    }

    if (isObituary !== undefined) {
      matchFlags.push({
        $expr: {
          $eq: [
            { $ifNull: ["$packageDetails.isObituary", false] },
            isObituary
          ]
        }
      });
    }

    if (isFeatured !== undefined) {
      matchFlags.push({
        $expr: {
          $eq: [
            { $ifNull: ["$packageDetails.isFeatured", false] },
            isFeatured
          ]
        }
      });
    }

    const aggregateQuery = [
      { $match: matchQuery },
      ...lookupPipeline,
      ...(matchFlags.length > 0 ? [{ $match: { $and: matchFlags } }] : []),
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const result = await Order.aggregate(aggregateQuery);
    const orders = result[0]?.data || [];
    const totalItems = result[0]?.totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
      },
    });
  } catch (error) {
    console.error("Filter Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res) => {
    const orderId = req.params.id;
  
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).send("Invalid Order ID");
    }
  
    try {
      const order = await Order.findById(orderId)
        .populate("tributeItems");
      if (!order) {
        return res.status(404).send("Order not found");
      }
      res.status(200).send(order);
    } catch (error) {
      res.status(500).send("Error retrieving the order");
    }
});

router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const order = await Order.findByIdAndUpdate(
        id,
        { isDeleted: true }, 
        { new: true }    
      );
  
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
  
      res.status(200).json("Order marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.delete("/:userId/:orderId", verifyTokenAndAuthorization, async (req, res) => {
  try {
    const { userId, orderId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const order = await Order.findOne({
      _id: orderId,
      username: user.username,
      isDeleted: false,
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found or already deleted." });
    }

    // Soft delete without triggering required validations
    await Order.updateOne(
      { _id: orderId },
      { $set: { isDeleted: true } },
      { runValidators: false }
    );

    res.status(200).json({ message: "Order deleted successfully." });
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/tribute/:orderId", async (req, res) => {
  const orderId = req.params.orderId;

  uploadAWS(orderId).fields([
    { name: "memoryImages", maxCount: 1 }
  ])(req, res, async (err) => {
    if (err) {
      console.error("Image upload error:", err);
      return res.status(500).send("Image upload failed");
    }

    req.body = sanitizeBodyKeys(req.body);

    try {
      const tribute = await createOrUpdateTribute(orderId, req.body, req.files);
      res.status(201).send(tribute);
    } catch (e) {
      console.error("Tribute creation error:", e.message);
      res.status(500).send(e.message || "Failed to create tribute");
    }
  });
});

router.put("/tribute/:tributeId", async (req, res) => {
  try {
    const { tributeStatus } = req.body;

    const validStatuses = ['Review Requested', 'Tribute Approved', 'Approval Denied', 'Expired'];
    if (!tributeStatus || !validStatuses.includes(tributeStatus)) {
      return res.status(400).send("Invalid or missing tributeStatus");
    }

    // Step 1: Update the tributeStatus
    const tribute = await TributeItem.findOneAndUpdate(
      { _id: req.params.tributeId, isDeleted: false },
      { tributeStatus },
      { new: true }
    );

    if (!tribute) {
      return res.status(404).send("Tribute not found");
    }

    // Step 2: If status is "Tribute Approved", update the related order
    if (tributeStatus === "Tribute Approved" && tribute.order) {
      // Push the tribute ID if not already present
      await Order.findByIdAndUpdate(tribute.order, {
        $addToSet: { tributeItems: tribute._id }, // avoids duplicates
        $set: { orderStatus: "Post Approved" }     // optional: set order status
      });
    }

    res.send(tribute);
  } catch (e) {
    console.error("Failed to update tributeStatus:", e.message);
    res.status(500).send("Failed to update tributeStatus");
  }
});

router.get("/tribute/all", verifyTokenAndAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
  
      const tribute = await TributeItem.find({ isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const totalTribute = await TributeItem.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        tribute,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTribute / limit),
          totalItems: totalTribute,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.delete("/tribute/:tributeId", async (req, res) => {
  try {
    const tribute = await TributeItem.findOne({ _id: req.params.tributeId, isDeleted: false });

    if (!tribute) {
      return res.status(404).send("Tribute not found or already deleted");
    }

    tribute.isDeleted = true;
    await tribute.save();

    await Order.findByIdAndUpdate(tribute.order, {
      $pull: { tributeItems: tribute._id }
    });

    res.send({ message: "Tribute deleted and removed from order", tribute });
  } catch (e) {
    console.error(e);
    res.status(500).send("Failed to delete tribute");
  }
});

router.post("/donation", async (req, res) => {
  const Stripe = require("stripe");
  const stripe = new Stripe(process.env.STRIPE_SECRET);
  const safeToString = (val) => (val ? val.toString() : "");

  try {
    const {
      email,
      name,
      address,
      phoneNumber,
      orderId,
      donationAmount,
      countryId,
    } = req.body;

    if (!donationAmount || !countryId) {
      return res.status(400).send("Required fields missing: donationAmount, countryId");
    }

    const country = await Country.findOne({
      _id: countryId,
      isActive: true,
      isDeleted: false,
    });
    if (!country) return res.status(400).send("Invalid or inactive country selected");

    const currencyCode = country.currencyCode;

    let finalPriceInCAD = {
      price: donationAmount,
      currencyCode: "CAD",
    };

    if (currencyCode.toLowerCase() !== "cad") {
      try {
        const url = `https://api.exchangerate.host/convert?from=${currencyCode}&to=CAD&amount=${donationAmount}&access_key=0ab9aa457e3235237a7aff525c1431e3`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Exchange API error: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        if (!result || typeof result.result !== "number") {
          throw new Error("Currency conversion failed: Invalid response");
        }

        finalPriceInCAD = {
          price: result.result,
          currencyCode: "CAD",
        };
      } catch (err) {
        return res.status(500).send("Failed to convert donation to CAD");
      }
    }

  let stripeCharge;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalPriceInCAD.price * 100),
      currency: "cad",
      automatic_payment_methods: {
        enabled: true,
      },
       metadata: {
          orderId: orderId ? orderId.toString() : "N/A",
          donor: email || name || "Anonymous",
        },
        description: `Donation by ${email || name || "Anonymous"}`,
    });
    stripeCharge = paymentIntent;
  } catch (err) {
    throw new Error("Stripe payment failed");
  } 

    // let stripeCharge;
    // try {
    //   const paymentIntent = await stripe.paymentIntents.create({
    //     amount: Math.round(finalPriceInCAD.price * 100),
    //     currency: "cad",
    //     automatic_payment_methods: {
    //       enabled: true,
    //       allow_redirects: "never",
    //     },
    //     metadata: {
    //       orderId: orderId ? orderId.toString() : "N/A",
    //       donor: email || name || "Anonymous",
    //     },
    //     description: `Donation by ${email || name || "Anonymous"}`,
    //   });

    //   if (paymentIntent.status === "requires_payment_method") {
    //     console.warn("PaymentIntent created, but needs payment method attached");
    //   }

    //   stripeCharge = paymentIntent;
    // } catch (err) {
    //   console.error("Stripe error:", err.message);
    //   return res.status(500).send(`Stripe payment failed: ${err.message}`);
    // }

    const donation = new Donation({
      email,
      name,
      address,
      phoneNumber,
      order: orderId || null,
      finalPrice: {
        country: country._id,
        price: donationAmount,
      },
      finalPriceInCAD,
    });

    await donation.save();

    // ✅ Update the Order model if this donation is tied to an order
    if (orderId) {
      const order = await Order.findById(orderId);

      if (order) {
        order.recievedDonations.push(donation._id);

        if (!order.donationRecieved || typeof order.donationRecieved.price !== "number") {
          order.donationRecieved = {
            price: finalPriceInCAD.price,
            currencyCode: "CAD"
          };
        } else {
          order.donationRecieved.price += finalPriceInCAD.price;
        }

        await order.save();
      }
    }

    return res.status(200).send({
      donation,
      paymentIntentClientSecret: stripeCharge.client_secret,
    });
  } catch (err) {
    console.error("Donation error:", err.message);
    return res.status(500).send(`Failed to process donation: ${err.message}`);
  }
});

router.put("/donation/:id", verifyTokenAndAdmin, async (req, res) => {
  const donationId = req.params.id;
  const { newStatus } = req.body;

  const validStatuses = [
    "Donation Recieved",
    "Donation Refunded",
  ];

  if (!mongoose.Types.ObjectId.isValid(donationId)) {
    return res.status(400).send("Invalid donation ID");
  }

  if (!validStatuses.includes(newStatus)) {
    return res.status(400).send("Invalid adminDonationStatus value");
  }

  try {
    const donation = await Donation.findById(donationId);
    if (!donation || donation.isDeleted) {
      return res.status(404).send("Donation not found or already deleted");
    }

    if (donation.adminDonationStatus === newStatus) {
      return res.status(200).json({ message: "No update required" });
    }

    donation.adminDonationStatus = newStatus;
    await donation.save();

    if (newStatus === "Donation Refunded" && donation.order) {
      const order = await Order.findById(donation.order);
      if (order) {
        order.recievedDonations = order.recievedDonations.filter(
          (dId) => dId.toString() !== donation._id.toString()
        );

        const deductionAmount = donation.finalPriceInCAD?.price || 0;
        if (
          order.donationRecieved &&
          typeof order.donationRecieved.price === "number"
        ) {
          order.donationRecieved.price = Math.max(
            0,
            order.donationRecieved.price - deductionAmount
          );
        }

        await order.save();
      }
    }

    return res.status(200).json({
      message: `Donation status updated to "${newStatus}"`,
      donationId: donation._id,
    });
  } catch (err) {
    console.error("Status update error:", err.message);
    return res.status(500).send("Failed to update donation status");
  }
});

router.delete("/donation/:id", verifyTokenAndAdmin, async (req, res) => {
  const donationId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(donationId)) {
    return res.status(400).send("Invalid donation ID");
  }

  try {
    const donation = await Donation.findById(donationId);
    if (!donation || donation.isDeleted) {
      return res.status(404).send("Donation not found or already deleted");
    }

    donation.isDeleted = true;
    await donation.save();

    if (donation.order) {
      const order = await Order.findById(donation.order);
      if (order) {
        order.recievedDonations = order.recievedDonations.filter(
          (dId) => dId.toString() !== donation._id.toString()
        );

        const deductionAmount = donation.finalPriceInCAD?.price || 0;
        if (
          order.donationRecieved &&
          typeof order.donationRecieved.price === "number"
        ) {
          order.donationRecieved.price = Math.max(
            0,
            order.donationRecieved.price - deductionAmount
          );
        }

        await order.save();
      }
    }

    return res.status(200).send({
      message: "Donation deleted and order updated successfully",
      donationId: donation._id,
    });
  } catch (err) {
    console.error("Donation delete error:", err.message);
    return res.status(500).send("Failed to delete donation");
  }
});

async function updateOrder(orderId, data, fileList) {
  const safeToString = (val) => (val ? val.toString() : "");

  if (
    !data.username ||
    !data.accountDetails ||
    !data.contactDetails ||
    !data.selectedPackage ||
    !data.selectedCountry
  ) {
    throw new Error("Required fields missing: username, accountDetails, contactDetails, selectedPackage, selectedCountry");
  }

  try {
    if (typeof data.accountDetails === "string") data.accountDetails = JSON.parse(data.accountDetails);
    if (typeof data.information === "string") data.information = JSON.parse(data.information);
    if (typeof data.selectedAddons === "string") data.selectedAddons = JSON.parse(data.selectedAddons);

    if (typeof data.contactDetails === "string") {
      data.contactDetails = JSON.parse(data.contactDetails);
    }

    if (Array.isArray(data.contactDetails) && typeof data.contactDetails[0] === "string") {
      data.contactDetails = data.contactDetails.map(str => {
        try {
          return JSON.parse(str);
        } catch {
          throw new Error("Invalid JSON in contactDetails array items");
        }
      });
    }
    if (!Array.isArray(data.contactDetails)) {
      throw new Error("contactDetails must be an array");
    }
  } catch (e) {
    throw new Error("Invalid JSON format in fields");
  }

  const country = await Country.findOne({
    _id: data.selectedCountry,
    isActive: true,
    isDeleted: false
  });
  if (!country) throw new Error("Invalid or inactive country selected");

  const currencyCode = country.currencyCode;

  const selectedPackage = await ObituaryRemembarancePackages.findOne({
    _id: data.selectedPackage,
    isActive: true,
    isDeleted: false
  }).populate(['bgColors', 'primaryImageBgFrames']);

  if (!selectedPackage) throw new Error("Invalid or inactive package");

  const packagePriceEntry = selectedPackage.priceList.find(p =>
    safeToString(p.country) === safeToString(country._id)
  );
  if (!packagePriceEntry) throw new Error(`Package pricing not available for selected country`);

  const basePackagePrice = {
    country: country._id,
    currencyCode: currencyCode,
    price: packagePriceEntry.price,
  };

  const packageAddonIds = (selectedPackage.addons || []).map(id => safeToString(id));
  const userAddonIds = Array.isArray(data.selectedAddons) ? data.selectedAddons.map(id => safeToString(id)) : [];
  const combinedAddonIds = [...new Set([...packageAddonIds, ...userAddonIds])];

  let addonsPrice = 0;
  let addonsWithPrices = [];

  if (combinedAddonIds.length > 0) {
    const addons = await Addons.find({
      _id: { $in: combinedAddonIds },
      isActive: true,
      isDeleted: false
    });

    addonsWithPrices = addons.map(addon => {
      const priceEntry = addon.priceList.find(p =>
        safeToString(p.country) === safeToString(country._id)
      );
      if (!priceEntry) {
        throw new Error(`Addon pricing not available for selected country, Addon ID: ${addon._id}`);
      }
      return {
        addonId: safeToString(addon._id),
        country: country._id,
        currencyCode: currencyCode,
        price: priceEntry.price
      };
    });

    addonsPrice = addonsWithPrices.reduce((sum, a) => sum + a.price, 0);
  }

  const finalPrice = {
    country: country._id,
    currencyCode: currencyCode,
    price: basePackagePrice.price + addonsPrice
  };

  let finalPriceInCAD = {
    price: finalPrice.price,
    currencyCode: "CAD"
  };

  if (currencyCode.toLowerCase() !== "cad") {
    try {
      const url = `https://api.exchangerate.host/convert?from=${currencyCode}&to=CAD&amount=${finalPrice.price}&access_key=${process.env.EXCHANGE_RATE_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Exchange API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result || typeof result.result !== "number") {
        throw new Error("Currency conversion failed: Invalid response");
      }

      finalPriceInCAD = {
        price: result.result,
        currencyCode: "CAD"
      };
    } catch (err) {
      throw new Error("Failed to convert final price to CAD");
    }
  }

  if (data.selectedBgColor) {
    const validBgColorIds = (selectedPackage.bgColors || []).map(bg => safeToString(bg._id));
    if (!validBgColorIds.includes(safeToString(data.selectedBgColor))) {
      throw new Error("Selected background color is not valid for this package");
    }
  }

  if (data.selectedPrimaryImageBgFrame) {
    const validFrameIds = (selectedPackage.primaryImageBgFrames || []).map(f => safeToString(f._id));
    if (!validFrameIds.includes(safeToString(data.selectedPrimaryImageBgFrame))) {
      throw new Error("Selected primary image frame is not valid for this package");
    }
  }

  const wordLimit = selectedPackage.wordLimit || 0;
  const descriptionText =
    data.information && typeof data.information.description === "string"
      ? data.information.description
      : "";

  const countWords = (str) =>
    str.trim().split(/\s+/).filter(Boolean).length;

  const descriptionWordCount = countWords(descriptionText);

  if (descriptionWordCount > wordLimit) {
    throw new Error(
      `Description exceeds the word limit of ${wordLimit}. Current word count: ${descriptionWordCount}`
    );
  }

  const maxContacts = selectedPackage.noofContectDetails || 0;
  if (data.contactDetails.length > maxContacts) {
    throw new Error(`Maximum allowed contact details for this package is ${maxContacts}`);
  }

  const maxImages = selectedPackage.noofAdditionalImages || 0;
  if ((data.additionalImages || []).length > maxImages) {
    throw new Error(`Maximum allowed additional images for this package is ${maxImages}`);
  }

  /* const stripe = new Stripe(process.env.STRIPE_SECRET);
  let stripeCharge;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalPriceInCAD.price * 100),
      currency: "cad",
      payment_method_types: ['card'],
      metadata: {
        orderId: orderId.toString(),
        customer: data.username,
      },
      description: `Order for ${data.username}`,
    });
    stripeCharge = paymentIntent;
  } catch (err) {
    throw new Error("Stripe payment failed");
  } */

const stripe = new Stripe(process.env.STRIPE_SECRET);
let stripeCharge;
try {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(finalPriceInCAD.price * 100),
    currency: "cad",
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
    metadata: {
      orderId: orderId.toString(),
      customer: data.username,
    },
    description: `Test order for ${data.username}`
  });

  if (paymentIntent.status === "requires_payment_method") {
    console.warn("PaymentIntent created, but needs payment method attached");
  }

  stripeCharge = paymentIntent;
} catch (err) {
  console.error("Stripe error:", err.message);
  throw new Error("Stripe payment failed");
}

  const updateData = {
    username: data.username,
    information: data.information || {},
    accountDetails: data.accountDetails,
    contactDetails: Array.isArray(data.contactDetails) ? data.contactDetails : [],
    selectedPackage: data.selectedPackage,
    selectedCountry: data.selectedCountry,
    selectedCountryName: country.name,
    selectedAddons: combinedAddonIds,
    selectedPrimaryImageBgFrame: data.selectedPrimaryImageBgFrame || null,
    selectedBgColor: data.selectedBgColor || null,
    isDeleted: false,
    basePackagePrice,
    finalPrice,
    finalPriceInCAD,
    ...(fileList?.primaryImage?.[0] && { primaryImage: fileList.primaryImage[0].location }),
    ...(fileList?.thumbnailImage?.[0] && { thumbnailImage: fileList.thumbnailImage[0].location }),
    ...(fileList?.additionalImages && {
      additionalImages: fileList.additionalImages.map((img) => img.location)
    }),
    ...(fileList?.slideshowImages && {
      slideshowImages: fileList.slideshowImages.map((img) => img.location)
    })
  };

  const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, { new: true });

  try {
    await sendOrderPlacedEmail(updatedOrder._id);
  } catch (emailErr) {
    console.error("Error sending order confirmation email:", emailErr.message);
  }

  return {
    order: updatedOrder,
    paymentIntentClientSecret: stripeCharge.client_secret
  };
}

async function editOrder(orderId, data, fileList) {
  const safeToString = (val) => (val ? val.toString() : "");

  if (
    !data.username ||
    !data.accountDetails ||
    !data.contactDetails ||
    !data.selectedPackage ||
    !data.selectedCountry
  ) {
    throw new Error("Required fields missing: username, accountDetails, contactDetails, selectedPackage, selectedCountry");
  }

  try {
    if (typeof data.accountDetails === "string") data.accountDetails = JSON.parse(data.accountDetails);
    if (typeof data.information === "string") data.information = JSON.parse(data.information);
    if (typeof data.selectedAddons === "string") data.selectedAddons = JSON.parse(data.selectedAddons);
    if (typeof data.contactDetails === "string") {
      data.contactDetails = JSON.parse(data.contactDetails);
    }

    if (Array.isArray(data.contactDetails) && typeof data.contactDetails[0] === "string") {
      data.contactDetails = data.contactDetails.map(str => {
        try {
          return JSON.parse(str);
        } catch {
          throw new Error("Invalid JSON in contactDetails array items");
        }
      });
    }

    if (!Array.isArray(data.contactDetails)) {
      throw new Error("contactDetails must be an array");
    }
  } catch (e) {
    throw new Error("Invalid JSON format in fields");
  }

  const country = await Country.findOne({
    _id: data.selectedCountry,
    isActive: true,
    isDeleted: false
  });
  if (!country) throw new Error("Invalid or inactive country selected");

  const currencyCode = country.currencyCode;

  const selectedPackage = await ObituaryRemembarancePackages.findOne({
    _id: data.selectedPackage,
    isActive: true,
    isDeleted: false
  }).populate(['bgColors', 'primaryImageBgFrames']);

  if (!selectedPackage) throw new Error("Invalid or inactive package");

  if (!selectedPackage.priceList || !Array.isArray(selectedPackage.priceList)) {
    throw new Error("Selected package priceList is missing or invalid");
  }

  const packagePriceEntry = selectedPackage.priceList.find(p =>
    safeToString(p.country) === safeToString(country._id)
  );
  if (!packagePriceEntry) throw new Error(`Package pricing not available for selected country`);

  const basePackagePrice = {
    country: country._id,
    currencyCode: currencyCode,
    price: packagePriceEntry.price,
  };

  const packageAddonIds = (selectedPackage.addons || []).map(id => safeToString(id));
  const userAddonIds = Array.isArray(data.selectedAddons) ? data.selectedAddons.map(id => safeToString(id)) : [];
  const combinedAddonIds = [...new Set([...packageAddonIds, ...userAddonIds])];

  let addonsPrice = 0;
  let addonsWithPrices = [];

  if (combinedAddonIds.length > 0) {
    const addons = await Addons.find({
      _id: { $in: combinedAddonIds },
      isActive: true,
      isDeleted: false
    });

    addonsWithPrices = addons.map(addon => {
      if (!addon.priceList || !Array.isArray(addon.priceList)) {
        throw new Error(`Addon priceList missing or invalid for Addon ID: ${addon._id}`);
      }

      const priceEntry = addon.priceList.find(p =>
        safeToString(p.country) === safeToString(country._id)
      );
      if (!priceEntry) {
        throw new Error(`Addon pricing not available for selected country, Addon ID: ${addon._id}`);
      }

      return {
        addonId: safeToString(addon._id),
        country: country._id,
        currencyCode: currencyCode,
        price: priceEntry.price
      };
    });

    addonsPrice = addonsWithPrices.reduce((sum, a) => sum + a.price, 0);
  }

  const finalPrice = {
    country: country._id,
    currencyCode: currencyCode,
    price: basePackagePrice.price + addonsPrice
  };

  let finalPriceInCAD = {
    price: finalPrice.price,
    currencyCode: "CAD"
  };

  if (currencyCode.toLowerCase() !== "cad") {
    try {
      const url = `https://api.exchangerate.host/convert?from=${currencyCode}&to=CAD&amount=${finalPrice.price}&access_key=${process.env.EXCHANGE_RATE_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Exchange API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result || typeof result.result !== "number") {
        console.error("Exchange API response was:", result);
        throw new Error("Currency conversion failed: Invalid response");
      }

      finalPriceInCAD = {
        price: result.result,
        currencyCode: "CAD"
      };
    } catch (err) {
      console.error("Currency conversion error:", err.message);
      throw new Error("Failed to convert final price to CAD");
    }
  }

  if (data.selectedBgColor) {
    const validBgColorIds = (selectedPackage.bgColors || []).map(bg => safeToString(bg._id));
    if (!validBgColorIds.includes(safeToString(data.selectedBgColor))) {
      throw new Error("Selected background color is not valid for this package");
    }
  }

  if (data.selectedPrimaryImageBgFrame) {
    const validFrameIds = (selectedPackage.primaryImageBgFrames || []).map(f => safeToString(f._id));
    if (!validFrameIds.includes(safeToString(data.selectedPrimaryImageBgFrame))) {
      throw new Error("Selected primary image frame is not valid for this package");
    }
  }

  const wordLimit = selectedPackage.wordLimit || 0;
  const descriptionText =
    data.information && typeof data.information.description === "string"
      ? data.information.description
      : "";

  const countWords = (str) =>
    str.trim().split(/\s+/).filter(Boolean).length;

  const descriptionWordCount = countWords(descriptionText);

  if (descriptionWordCount > wordLimit) {
    throw new Error(
      `Description exceeds the word limit of ${wordLimit}. Current word count: ${descriptionWordCount}`
    );
  }

  const maxContacts = selectedPackage.noofContectDetails || 0;
  if (data.contactDetails.length > maxContacts) {
    throw new Error(`Maximum allowed contact details for this package is ${maxContacts}`);
  }

  const maxImages = selectedPackage.noofAdditionalImages || 0;
  if ((data.additionalImages || []).length > maxImages) {
    throw new Error(`Maximum allowed additional images for this package is ${maxImages}`);
  }

  const existingOrder = await Order.findById(orderId);
  if (!existingOrder) {
    throw new Error("Order not found");
  }

  const wasStatusChanged = data.orderStatus && data.orderStatus !== existingOrder.orderStatus;

  let expiryDate = existingOrder.expiryDate;

  if (wasStatusChanged && data.orderStatus === "Post Approved") {
    const durationInDays = selectedPackage.duration || 0;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + durationInDays);
    expiryDate = expiry.toISOString();
  }

  const updateData = {
    username: data.username,
    information: data.information || {},
    accountDetails: data.accountDetails,
    contactDetails: Array.isArray(data.contactDetails) ? data.contactDetails : [],
    selectedPackage: data.selectedPackage,
    selectedCountryName: country.name,
    selectedAddons: combinedAddonIds,
    selectedPrimaryImageBgFrame: data.selectedPrimaryImageBgFrame || null,
    selectedBgColor: data.selectedBgColor || null,
    isDeleted: false,
    basePackagePrice,
    finalPrice,
    finalPriceInCAD,
    expiryDate,
    ...(fileList?.primaryImage?.[0] && { primaryImage: fileList.primaryImage[0].location }),
    ...(fileList?.thumbnailImage?.[0] && { thumbnailImage: fileList.thumbnailImage[0].location }),
    ...(fileList?.additionalImages && {
      additionalImages: fileList.additionalImages.map((img) => img.location)
    }),
    ...(fileList?.slideshowImages && {
      slideshowImages: fileList.slideshowImages.map((img) => img.location)
    }),
    ...(data.orderStatus && { orderStatus: data.orderStatus })
  };

  const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, { new: true });

  if (wasStatusChanged) {
    try {
      await sendOrderUpdateEmail(updatedOrder._id);
    } catch (emailErr) {
      console.error("Error sending order confirmation email:", emailErr.message);
    }
  }

  return updatedOrder;
}

async function createOrUpdateTribute(orderId, data, fileList, tributeId = null) {
  const validTypes = ["message", "card", "letter", "memory", "flower"];
  const tributeOptions = data.tributeOptions;

  if (!tributeOptions || !validTypes.includes(tributeOptions)) {
    throw new Error("Invalid or missing tributeOptions");
  }

  const order = await Order.findOne({
    _id: orderId,
    isDeleted: false,
    orderStatus: "Post Approved",
  });
  if (!order) throw new Error("Order not found or not approved");

  ["message", "card", "letter", "memory", "flower"].forEach((key) => {
    if (typeof data[key] === "string") {
      try {
        data[key] = JSON.parse(data[key]);
      } catch {
        throw new Error(`Invalid JSON in field: ${key}`);
      }
    }
  });

  const tributeData = {
    tributeOptions,
    order: order._id,
    isDeleted: false,
    isActive: data.isActive !== undefined ? data.isActive : true,
  };

  if (tributeOptions === "message") {
    tributeData.message = data.message;
  } else if (tributeOptions === "card") {
    tributeData.card = {
      cardTemplate: data.card?.cardTemplate,
      message: data.card?.message,
      name: data.card?.name,
      relationship: data.card?.relationship,
      country: data.card?.country,
    };
  } else if (tributeOptions === "letter") {
    tributeData.letter = {
      letterTemplate: data.letter?.letterTemplate,
      message: data.letter?.message,
      name: data.letter?.name,
      relationship: data.letter?.relationship,
      country: data.letter?.country,
    };
  } else if (tributeOptions === "memory") {
    tributeData.memory = {
      email: data.memory?.email,
      message: data.memory?.message,
      name: data.memory?.name,
      relationship: data.memory?.relationship,
      country: data.memory?.country,
      images: (fileList?.memoryImages?.[0]?.location) || "",
    };
  } else if (tributeOptions === "flower") {
    tributeData.flower = {
      flowerType: data.flower?.flowerType,
      email: data.flower?.email,
      message: data.flower?.message,
      name: data.flower?.name,
      relationship: data.flower?.relationship,
      country: data.flower?.country,
    };
  }

  let result;
  if (tributeId) {
    result = await TributeItem.findByIdAndUpdate(tributeId, tributeData, { new: true });
    if (!result) throw new Error("Failed to update tribute");
  } else {
    result = await TributeItem.create(tributeData);
  }

  return result;
}
  
function sanitizeBodyKeys(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.trim(), v])
    );
}

module.exports = router;
