const { Advertistment } = require("../models/advertistment");
const { AdType } = require("../models/adType");
const { AdCategory } = require("../models/adCategory");
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { verifyToken, verifyTokenAndAuthorization, verifyTokenAndAdmin } = require("./verifyToken");
const multer = require("multer");
const multerS3 = require("multer-s3");
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

const uploadAWS = (adId) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${adId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
});

const uploadOptions = multer({ storage: storage });

router.post("/ad-type", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { imageSize, type, isActive } = req.body;
  
      const newAdType = new AdType({ imageSize, type, isActive});
  
      const savedAdType = await newAdType.save();
      res.status(201).json(savedAdType);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.put("/ad-type/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { imageSize, type, isActive } = req.body;
  
      const updatedAdType = await AdType.findByIdAndUpdate(
        id,
        { imageSize, type, isActive },
        { new: true, runValidators: true }
      );
  
      if (!updatedAdType) {
        return res.status(404).json({ message: "Ad Type not found" });
      }
  
      res.status(200).json(updatedAdType);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.get("/ad-type/active", verifyTokenAndAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
  
    try {
      const adTypes = await AdType.find({ isActive: true, isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const total = await AdType.countDocuments({ isActive: true, isDeleted: false });
  
      res.status(200).json({
        adTypes,
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
  
router.get("/ad-type/all", verifyTokenAndAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
  
    try {
      const adTypes = await AdType.find({ isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const total = await AdType.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        adTypes,
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
  
router.get("/ad-type/:id",verifyTokenAndAdmin, async (req, res) => {
    const adTypeId = req.params.id;
  
    if (!mongoose.isValidObjectId(adTypeId)) {
      return res.status(400).send("Invalid Ad Type ID");
    }
  
    try {
      const adType = await AdType.findById(adTypeId);
      if (!adType) {
        return res.status(404).send("Ad Type not found");
      }
      res.status(200).send(adType);
    } catch (error) {
      res.status(500).send("Error retrieving the Ad Type");
    }
});

router.delete("/ad-type/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adType = await AdType.findByIdAndUpdate(
        id,
        { isDeleted: true,isActive: false  }, 
        { new: true }    
      );
  
      if (!adType) {
        return res.status(404).json({ message: "Ad Type not found" });
      }
  
      res.status(200).json("Ad Type marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

//Ad Category APIS

router.post("/ad-category", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { name, type, isActive } = req.body;
  
      const newAdCategory = new AdCategory({ name, type, isActive});
  
      const savedAdCategory = await newAdCategory.save();
      res.status(201).json(savedAdCategory);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.put("/ad-category/:id",verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, type, isActive } = req.body;
  
      const updatedAdCategory = await AdCategory.findByIdAndUpdate(
        id,
        { name, type, isActive },
        { new: true, runValidators: true }
      );
  
      if (!updatedAdCategory) {
        return res.status(404).json({ message: "Ad Category not found" });
      }
  
      res.status(200).json(updatedAdCategory);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.get("/ad-category/active", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
  
    try {
      const adCategory = await AdCategory.find({ isActive: true, isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const total = await AdCategory.countDocuments({ isActive: true, isDeleted: false });
  
      res.status(200).json({
        adCategory,
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
  
router.get("/ad-category/all", verifyTokenAndAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
  
    try {
      const adCategory = await AdCategory.find({ isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const total = await AdCategory.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        adCategory,
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
  
router.get("/ad-category/:id", async (req, res) => {
    const adCategoryId = req.params.id;
  
    if (!mongoose.isValidObjectId(adCategoryId)) {
      return res.status(400).send("Invalid Ad Category ID");
    }
  
    try {
      const adCategory = await AdCategory.findById(adCategoryId);
      if (!adCategory) {
        return res.status(404).send("Ad Category not found");
      }
      res.status(200).send(adCategory);
    } catch (error) {
      res.status(500).send("Error retrieving the Ad Category");
    }
});

router.delete("/ad-category/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adCategory = await AdCategory.findByIdAndUpdate(
        id,
        { isDeleted: true,isActive: false  }, 
        { new: true }    
      );
  
      if (!adCategory) {
        return res.status(404).json({ message: "Ad Category not found" });
      }
  
      res.status(200).json("Ad Category marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

//Advertistment APIS

router.post("/", verifyTokenAndAdmin, async (req, res) => {
    let adId;
  
    try {
      // First: Create a placeholder advertisement to get an _id
      let ad = new Advertistment({
        image: "TEMP",
        adType: "TEMP",
        adCategory: "TEMP",
        adPageName:"TEMP",
        expiryDate: "TEMP",
      });
  
      ad = await ad.save({ validateBeforeSave: false });
      adId = ad._id.toString();
  
      // Upload image with AWS
      uploadAWS(adId).fields([{ name: "image", maxCount: 1 }])(req, res, async (err) => {
        if (err) {
          await Advertistment.findByIdAndDelete(adId);
          return res.status(500).send("Image upload failed");
        }

        req.body = sanitizeBodyKeys(req.body);
  
        try {
          const updatedAd = await updateAdvertisement(adId, req.body, req.files);
          
          if (!updatedAd) {
            await Advertistment.findByIdAndDelete(adId);
            return res.status(500).send("Advertisement update failed");
          }
  
          res.send(updatedAd);
        } catch (updateErr) {
          console.error(updateErr);
          await Advertistment.findByIdAndDelete(adId);
          return res.status(500).send(updateErr.message || "Advertisement update error");
        }
      });
  
    } catch (e) {
      console.error(e);
      if (adId) {
        await Advertistment.findByIdAndDelete(adId);
      }
      return res.status(500).send("Failed to create advertisement");
    }
});

router.post(`/update`, verifyTokenAndAdmin, async (req, res) => {
    try {
      await uploadAWS(req.body.adId).fields([
        { name: "image", maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) {
          return res.status(500).send("The Advertisement cannot be updated");
        }
        let advertistment = await updateAdvertisement(req.body.adId, req.body, req.files);
        if (!advertistment) {
          return res.status(500).send("The Advertisement cannot be updated");
        }
        res.send(advertistment);
      });
    } catch (e) {
      return res.status(500).send("The Advertisement cannot be updated");
    }
});

router.get("/active", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { adCategory } = req.query;
  
    try {
      const filter = {
        isActive: true,
        isDeleted: false,
      };
  
      if (adCategory) {
        if (!mongoose.Types.ObjectId.isValid(adCategory)) {
          return res.status(400).json({ message: "Invalid ad category ID format" });
        }
  
        const categoryExists = await AdCategory.findById(adCategory);
        if (!categoryExists) {
          return res.status(404).json({ message: "ad category not found" });
        }
  
        filter.adCategory = adCategory;
      }
  
      const advertisements = await Advertistment.find(filter)
        .populate("adType")
        .populate("adCategory")
        .skip(skip)
        .limit(limit)
        .sort({ uploadedDate: -1 });
  
      const total = await Advertistment.countDocuments(filter);
  
      res.status(200).json({
        advertisements,
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

router.get("/all", verifyTokenAndAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;     
    const limit = parseInt(req.query.limit) || 10;  
    const skip = (page - 1) * limit;
  
    try {
      const advertisements = await Advertistment.find({ isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ uploadedDate: -1 });
  
      const total = await Advertistment.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        advertisements,
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

router.get('/ad-categories-with-count', async (req, res) => {
    try {
      const categoriesWithCounts = await AdCategory.aggregate([
        {
          $match: {
            isDeleted: false,
            isActive: true
          }
        },
        {
          $lookup: {
            from: 'advertistments', // MongoDB collection name (plural lowercase)
            localField: '_id',
            foreignField: 'adCategory',
            as: 'ads'
          }
        },
        {
          $addFields: {
            adCount: {
              $size: {
                $filter: {
                  input: "$ads",
                  as: "ad",
                  cond: { $and: [
                    { $eq: ["$$ad.isDeleted", false] },
                    { $eq: ["$$ad.isActive", true] }
                  ]}
                }
              }
            }
          }
        },
        {
          $project: {
            name: 1,
            adCount: 1
          }
        }
      ]);
  
      res.json(categoriesWithCounts);
    } catch (error) {
      console.error("Error fetching ad categories with count:", error);
      res.status(500).json({ message: "Server error" });
    }
});

router.get("/by-ad-type-ad-page", async (req, res) => {
    try {
      const { adType, adPageName } = req.query;
  
      if (!adType || !adPageName) {
        return res.status(400).json({ message: "adType and adPageName are required" });
      }
  
      const ads = await Advertistment.find({
        adType,
        adPageName,
        isDeleted: false,
        isActive: true,
      }).populate("adType").populate("adCategory");
  
      res.status(200).json(ads);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.get("/by-category", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { adCategory } = req.query;
  
    if (!adCategory) {
      return res.status(400).json({ message: "adCategory is required" });
    }
  
    try {
      const advertisements = await Advertistment.find({
        adCategory,
        isDeleted: false,
        isActive: true,
      })
        .populate("adType")
        .populate("adCategory")
        .skip(skip)
        .limit(limit)
        .sort({ uploadedDate: -1 });
  
      const total = await Advertistment.countDocuments({
        adCategory,
        isDeleted: false,
        isActive: true,
      });
  
      res.status(200).json({
        advertisements,
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
    const adId = req.params.id;
  
    if (!mongoose.isValidObjectId(adId)) {
      return res.status(400).send("Invalid Advertisement ID");
    }
  
    try {
      const advertisement = await Advertistment.findById(adId);
      if (!advertisement) {
        return res.status(404).send("Advertisement not found");
      }
      res.status(200).send(advertisement);
    } catch (error) {
      res.status(500).send("Error retrieving the advertisement");
    }
});

router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const advertisement = await Advertistment.findByIdAndUpdate(
        id,
        { isDeleted: true }, 
        { new: true }    
      );
  
      if (!advertisement) {
        return res.status(404).json({ message: "Advertistment not found" });
      }
  
      res.status(200).json("Advertistment marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

  
async function updateAdvertisement(adId, data, fileList) {
    if (!data.adType) throw new Error("Ad type is required");
    if (!data.adCategory) throw new Error("Ad category is required");
    if (!data.expiryDate) throw new Error("Expiry date is required");    
    if (!data.adPageName) throw new Error("Ad page name is required");

    const adTypeExists = await AdType.findById(data.adType);
    if (!adTypeExists) throw new Error("Invalid ad type");

    const adCategoryExists = await AdCategory.findById(data.adCategory);
    if (!adCategoryExists) throw new Error("Invalid ad category");
  
    const updateData = {
      link: data.link || '',
      adType: data.adType,
      adCategory: data.adCategory,
      adPageName: data.adPageName || null,
      isDeleted: false,
      isActive: true,
      expiryDate: new Date(data.expiryDate),
      ...(fileList?.image?.[0] && { image: fileList.image[0].location }),
    };
  
    const updatedAd = await Advertistment.findByIdAndUpdate(adId, updateData, { new: true });
  
    return updatedAd;
}

function sanitizeBodyKeys(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.trim(), v])
    );
}

module.exports = router;
 

