const express = require('express');
const router = express.Router();
const { verifyTokenAndAdmin } = require("./verifyToken");
const aws = require("aws-sdk");
const uuid = require("uuid");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const Addon = require("../models/advertistment");
const AdPage = require("../models/adType");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

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

  const uploadAWS = (prodId) =>
    multer({
        storage: multerS3({
        s3: s3,
        acl: "public-read",
        bucket: process.env.SPACE_BUCKET_NAME,
        key: function (req, file, cb) {
            const uniqueFilename = `${prodId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
            cb(null, uniqueFilename);
        },
        contentType: multerS3.AUTO_CONTENT_TYPE,
        }),
  });

// POST: Create new ad
router.post('/', verifyTokenAndAdmin, uploadAWS.single('image'), async (req, res) => {
  try {
    const newAd = new Addon({
      image: req.file?.location || '',
      link: req.body.link,
      adPage: req.body.adPageId,
    });
    await newAd.save();
    res.status(201).json(newAd);
  } catch (err) {
    res.status(500).json({ message: "Failed to create ad", error: err });
  }
});

// PUT: Update ad by ID
router.put('/:id', verifyTokenAndAdmin, uploadAWS.single('image'), async (req, res) => {
  try {
    const updatedFields = {
      link: req.body.link,
    };
    if (req.file?.location) {
      updatedFields.image = req.file.location;
    }
    const updatedAd = await Addon.findByIdAndUpdate(req.params.id, updatedFields, { new: true });
    res.status(200).json(updatedAd);
  } catch (err) {
    res.status(500).json({ message: "Failed to update ad", error: err });
  }
});

// DELETE: Soft delete
router.delete('/:id', verifyTokenAndAdmin, async (req, res) => {
    try {
      const ad = await Addon.findById(req.params.id);
  
      if (!ad) return res.status(404).json({ message: "Ad not found" });
  
      // Extract the image key from the URL
      if (ad.image) {
        const urlParts = ad.image.split('/');
        const Key = urlParts.slice(3).join('/'); // remove https://<bucket-name>.s3.region.amazonaws.com/
        
        const deleteParams = {
          Bucket: process.env.SPACE_BUCKET_NAME,
          Key,
        };
  
        await s3.send(new DeleteObjectCommand(deleteParams));
      }
  
      // Soft delete the ad
      await Addon.findByIdAndUpdate(req.params.id, { isDeleted: true });
  
      res.status(200).json({ message: "Ad and image deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete ad", error: err });
    }
  });

// GET: Get all ads by ad page
router.get('/byPage/:pageId', async (req, res) => {
  try {
    const ads = await Addon.find({ adPage: req.params.pageId, isDeleted: false }).populate("adPage");
    res.status(200).json(ads);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch ads", error: err });
  }
});

// GET: Paginated ads
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const ads = await Addon.find({ isDeleted: false })
      .populate("adPage")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await Addon.countDocuments({ isDeleted: false });
    res.status(200).json({ data: ads, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch ads", error: err });
  }
});

module.exports = router;
