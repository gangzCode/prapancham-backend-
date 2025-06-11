const express = require("express");
const router = express.Router();
const { ObituaryRemembarancePackages } = require("../models/obituaryRemembarance-packages");
const { verifyTokenAndAuthorization,verifyTokenAndAdmin } = require("./verifyToken");
const { Addons } = require("../models/addons");
const { Order } = require("../models/order");
const { User } = require("../models/user");
const { Country } = require("../models/country");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const multer = require("multer");
const multerS3 = require("multer-s3");
const aws = require("aws-sdk");
const uuid = require("uuid");
const { S3Client } = require("@aws-sdk/client-s3");
const { sendOrderPlacedEmail } = require("../report/nodemailer");


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
      { name: "additionalImages", maxCount: 10 }
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
        { name: "additionalImages", maxCount: 10 }
      ])(req, res, async (err) => {
        if (err) {
          return res.status(500).send("The order cannot be updated");
        }
  
        const event = await updateOrder(req.body.orderId, req.body, req.files);
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

router.get("/:id", async (req, res) => {
    const orderId = req.params.id;
  
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).send("Invalid Order ID");
    }
  
    try {
      const order = await Order.findById(orderId);
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

async function updateOrder(orderId, data, fileList) {
  const safeToString = (val) => (val ? val.toString() : "");
  
  //const currency = "cad"; 
  //const cToken = req.body.cToken;

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

  if (!country._id) throw new Error("Country._id is missing");

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

  /* const options = {
    method: "POST",
    url: "https://scl-sandbox.dev.clover.com/v1/charges",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${process.env.CLOVER_SECRET}`,
    },
    body: {
      ecomind: "ecom",
      metadata: { existingDebtIndicator: false },
      amount: Math.round(totalCharge),
      currency: currency,
      source: cToken,
    },
    json: true,
  };

  const cloverResponse = await new Promise((resolve, reject) => {
    request(options, (error, response, body) => {
      if (error) return reject(error);
      if (body.status !== "succeeded") return reject(new Error(body.error?.message || "Payment failed"));
      resolve(body);
    });
  }); */


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
    ...(fileList?.primaryImage?.[0] && { primaryImage: fileList.primaryImage[0].location }),
    ...(fileList?.thumbnailImage?.[0] && { thumbnailImage: fileList.thumbnailImage[0].location }),
    ...(fileList?.additionalImages && {
      additionalImages: fileList.additionalImages.map((img) => img.location)
    })
  };

  const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, { new: true });

  try {
    await sendOrderPlacedEmail(updatedOrder._id);
  } catch (emailErr) {
    console.error("Error sending order confirmation email:", emailErr.message);
  }

  return updatedOrder;

}
  
function sanitizeBodyKeys(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.trim(), v])
    );
}

module.exports = router;
