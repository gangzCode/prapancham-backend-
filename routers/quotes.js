const { Quotes } = require("../models/quotes");
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { verifyToken, verifyTokenAndAuthorization, verifyTokenAndAdmin } = require("./verifyToken");
const multer = require("multer");
const multerS3 = require("multer-s3");
const fs = require("fs");
const aws = require("aws-sdk");
const uuid = require("uuid");
const { S3Client } = require("@aws-sdk/client-s3");

const dotenv = require("dotenv");

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

const FILE_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const isValid = FILE_TYPE_MAP[file.mimetype];
    let uploadError = new Error("invalid image type");

    if (isValid) {
      uploadError = null;
    }
    cb(uploadError, "public/uploads");
  },
  filename: function (req, file, cb) {
    const fileName = file.originalname.split(" ").join("-");
    const extension = FILE_TYPE_MAP[file.mimetype];
    cb(null, `${fileName}-${Date.now()}.${extension}`);
  },
});

const uploadAWS = (quotesId) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${quotesId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
});

const uploadOptions = multer({ storage: storage });

router.post("/", verifyTokenAndAdmin, async (req, res) => {
    let quoteId;
  
    try {
      let quote = new Quotes({
        name: { en: [], ta: [], si: [] },
        posistion: { en: [], ta: [], si: [] },
        quote: { en: [], ta: [], si: [] },
      });
  
      quote = await quote.save({ validateBeforeSave: false });
      quoteId = quote._id.toString();
  
      uploadAWS(quoteId).fields([
        { name: "image", maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) {
          await Event.findByIdAndDelete(quoteId);
          return res.status(500).send("Image upload failed");
        }
  
        req.body = sanitizeBodyKeys(req.body);
  
        try {
          const updatedQuote = await updateQuote(quoteId, req.body, req.files);
          if (!updatedQuote) {
            await Event.findByIdAndDelete(quoteId);
            return res.status(500).send("Quote update failed");
          }
  
          res.send(updatedQuote);
        } catch (updateErr) {
          console.error(updateErr);
          await Event.findByIdAndDelete(quoteId);
          return res.status(500).send(updateErr.message || "Quote update error");
        }
      });
  
    } catch (e) {
      console.error(e);
      if (quoteId) {
        await Event.findByIdAndDelete(quoteId);
      }
      return res.status(500).send("Failed to create quote");
    }
});
  
router.post("/update", verifyTokenAndAdmin, async (req, res) => {
    try {
      await uploadAWS(req.body.quoteId).fields([
        { name: "image", maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) {
          return res.status(500).send("The quote cannot be updated");
        }
  
        const quote = await updateEvent(req.body.quoteId, req.body, req.files);
        if (!quote) {
          return res.status(500).send("The quote cannot be updated");
        }
  
        res.send(event);
      });
    } catch (e) {
      return res.status(500).send("The quote cannot be updated");
    }
});
  
router.get("/active", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const quotes = await Quotes.find({ isActive: true,isDeleted: false })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Quotes.countDocuments({ isActive: true,isDeleted: false });

    res.status(200).json({
        quotes,
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

router.get("/recent/:limit", async (req, res) => {
    const limit = parseInt(req.params.limit) || 5;
  
    try {
      const recentQuotes = await Quotes.find({
        isActive: true,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .limit(limit);
  
      res.status(200).json(recentQuotes);
    } catch (err) {
      console.error("Error fetching recent quotes:", err);
      res.status(500).json({ message: "Server Error" });
    }
});
 
router.get("/all", verifyTokenAndAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
  
      const quote = await Quotes.find({ isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const total = await Quotes.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        quote,
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

router.get("/:id", async (req, res) => {
    const quoteId = req.params.id;
  
    if (!mongoose.isValidObjectId(quoteId)) {
      return res.status(400).send("Invalid quote ID");
    }
  
    try {
      const quote = await Quotes.findById(quoteId);
      if (!quote) {
        return res.status(404).send("Quote not found");
      }
      res.status(200).send(quote);
    } catch (error) {
      res.status(500).send("Error retrieving the quote");
    }
});

router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const quote = await Quotes.findByIdAndUpdate(
        id,
        { isDeleted: true }, 
        { new: true }    
      );
  
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
  
      res.status(200).json("Quote marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});
  
async function updateQuote(quoteId, data, fileList) {
    if (!data.name || !data.quote || !data.posistion) throw new Error("Name, quote and description are required");

    let name = data.name;
    let quote = data.quote;
    let posistion = data.posistion;

    try {
    if (typeof name === "string") name = JSON.parse(name);
    if (typeof quote === "string") quote = JSON.parse(quote);
    if (typeof posistion === "string") posistion = JSON.parse(posistion);
    } catch (e) {
    throw new Error("Invalid JSON in name,quote or posistion");
    }
  
    const updateData = {
      name,
      quote,
      posistion,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isDeleted: false,
      ...(fileList && fileList.image && fileList.image[0] && { image: fileList.image[0].location }),
    };
  
    const updatedQuote = await Quotes.findByIdAndUpdate(quoteId, updateData, { new: true });
    return updatedQuote;
}
  
function sanitizeBodyKeys(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.trim(), v])
    );
}
  
module.exports = router;