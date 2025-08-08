const express = require("express");
const router = express.Router();
const { verifyTokenAndAdmin } = require("./verifyToken");
const { TributeCardTemplate } = require("../models/tributeCardTemplate");
const { TributeLetterTemplate } = require("../models/tributeLetterTemplate");
const { TributeMemoryPricing } = require("../models/tributeMemoryPricing");
const { TributeFlowerType } = require("../models/tributeFlowerType");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const multer = require("multer");
const multerS3 = require("multer-s3");
const aws = require("aws-sdk");
const uuid = require("uuid");
const { S3Client } = require("@aws-sdk/client-s3");

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

const uploadAWS = (id) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${id}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
});

//Tribute Card Template Item APIs

router.post("/card-template", verifyTokenAndAdmin, async (req, res) => {
    let cardTemplateId;
    
      try {
        let tributeCardTemplate = new TributeCardTemplate({
            image: "TEMP",
            name: "TEMP"
        });
    
        tributeCardTemplate = await tributeCardTemplate.save({ validateBeforeSave: false });
        cardTemplateId = tributeCardTemplate._id.toString();
    
        uploadAWS(cardTemplateId).fields([{ name: "image", maxCount: 1 }])(req, res, async (err) => {
          if (err) {
            await TributeCardTemplate.findByIdAndDelete(cardTemplateId);
            return res.status(500).send("Card Template image upload failed");
          }
  
          req.body = sanitizeBodyKeys(req.body);
    
          try {
            const updatedTributeCardTemplate = await updateCardTemplate(cardTemplateId, req.body, req.files);
            
            if (!updatedTributeCardTemplate) {
              await TributeCardTemplate.findByIdAndDelete(cardTemplateId);
              return res.status(500).send("Card Template update failed");
            }
    
            res.send(updatedTributeCardTemplate);
          } catch (updateErr) {
            console.error(updateErr);
            await TributeCardTemplate.findByIdAndDelete(cardTemplateId);
            return res.status(500).send(updateErr.message || "Card Template update error");
          }
        });
    
      } catch (e) {
        console.error(e);
        if (cardTemplateId) {
          await TributeCardTemplate.findByIdAndDelete(cardTemplateId);
        }
        return res.status(500).send("Failed to create card template");
      }
});
  
router.post(`/card-template/update`, verifyTokenAndAdmin, async (req, res) => {
    try {
      await uploadAWS(req.body.cardTemplateId).fields([
        { name: "image", maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) {
          return res.status(500).send("The tribute card template cannot be updated");
        }
        let tributeCardTemplate = await updateCardTemplate(req.body.cardTemplateId, req.body, req.files);
        if (!tributeCardTemplate) {
          return res.status(500).send("The tribute card template cannot be updated");
        }
        res.send(tributeCardTemplate);
      });
    } catch (e) {
      return res.status(500).send("The tribute card template cannot be updated");
    }
});
  
router.get("/card-template/all", verifyTokenAndAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
  
      const skip = (page - 1) * limit;
  
      const tributeCardTemplate = await TributeCardTemplate.find({ isDeleted: false })
        .skip(skip)
        .limit(limit);
  
      const totalTributeCardTemplate = await TributeCardTemplate.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        tributeCardTemplate,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTributeCardTemplate / limit),
          totalItems: totalTributeCardTemplate,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});
  
router.get("/card-template/active", async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
  
      const skip = (page - 1) * limit;
  
      const tributeCardTemplate = await TributeCardTemplate.find({ isActive: true,isDeleted: false })
        .skip(skip)
        .limit(limit);
  
      const totalTributeCardTemplate = await TributeCardTemplate.countDocuments({ isActive: true,isDeleted: false});
  
      res.status(200).json({
        tributeCardTemplate,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTributeCardTemplate / limit),
          totalItems: totalTributeCardTemplate,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});
  
router.get("/card-template/:id", async (req, res) => {
    const cardTemplateId = req.params.id;
  
    if (!mongoose.isValidObjectId(cardTemplateId)) {
      return res.status(400).send("Invalid tribute card template ID");
    }
  
    try {
      const tributeCardTemplate = await TributeCardTemplate.findById(cardTemplateId);
      if (!tributeCardTemplate) {
        return res.status(404).send("Tribute card template not found");
      }
      res.status(200).send(tributeCardTemplate);
    } catch (error) {
      res.status(500).send("Error retrieving the tribute card template");
    }
});
  
router.delete("/card-template/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const tributeCardTemplate = await TributeCardTemplate.findByIdAndUpdate(
        id,
        { isDeleted: true }, 
        { new: true }    
      );
  
      if (!tributeCardTemplate) {
        return res.status(404).json({ message: "Tribute card template not found" });
      }
  
      res.status(200).json("Tribute card template marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

//Tribute Letter Template Item APIs

router.post("/letter-template", verifyTokenAndAdmin, async (req, res) => {
    let letterTemplateId;
    
      try {
        let tributeLetterTemplate = new TributeLetterTemplate({
            image: "TEMP",
            name: "TEMP"
        });
    
        tributeLetterTemplate = await tributeLetterTemplate.save({ validateBeforeSave: false });
        letterTemplateId = tributeLetterTemplate._id.toString();
    
        uploadAWS(letterTemplateId).fields([{ name: "image", maxCount: 1 }])(req, res, async (err) => {
          if (err) {
            await TributeLetterTemplate.findByIdAndDelete(letterTemplateId);
            return res.status(500).send("Letter Template image upload failed");
          }
  
          req.body = sanitizeBodyKeys(req.body);
    
          try {
            const updatedTributeLetterTemplate = await updateLetterTemplate(letterTemplateId, req.body, req.files);
            
            if (!updatedTributeLetterTemplate) {
              await TributeLetterTemplate.findByIdAndDelete(letterTemplateId);
              return res.status(500).send("Letter Template update failed");
            }
    
            res.send(updatedTributeLetterTemplate);
          } catch (updateErr) {
            console.error(updateErr);
            await TributeLetterTemplate.findByIdAndDelete(letterTemplateId);
            return res.status(500).send(updateErr.message || "Letter Template update error");
          }
        });
    
      } catch (e) {
        console.error(e);
        if (letterTemplateId) {
          await TributeLetterTemplate.findByIdAndDelete(letterTemplateId);
        }
        return res.status(500).send("Failed to create letter template");
      }
});
  
router.post(`/letter-template/update`, verifyTokenAndAdmin, async (req, res) => {
    try {
      await uploadAWS(req.body.letterTemplateId).fields([
        { name: "image", maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) {
          return res.status(500).send("The tribute letter template cannot be updated");
        }
        let tributeLetterTemplate = await updateLetterTemplate(req.body.letterTemplateId, req.body, req.files);
        if (!tributeLetterTemplate) {
          return res.status(500).send("The tribute letter template cannot be updated");
        }
        res.send(tributeLetterTemplate);
      });
    } catch (e) {
      return res.status(500).send("The tribute letter template cannot be updated");
    }
});
  
router.get("/letter-template/all", verifyTokenAndAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
  
      const skip = (page - 1) * limit;
  
      const tributeLetterTemplate = await TributeLetterTemplate.find({ isDeleted: false })
        .skip(skip)
        .limit(limit);
  
      const totalTributeLetterTemplate = await TributeLetterTemplate.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        tributeLetterTemplate,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTributeLetterTemplate / limit),
          totalItems: totalTributeLetterTemplate,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});
  
router.get("/letter-template/active", async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
  
      const skip = (page - 1) * limit;
  
      const tributeLetterTemplate = await TributeLetterTemplate.find({ isActive: true,isDeleted: false })
        .skip(skip)
        .limit(limit);
  
      const totalTributeLetterTemplate = await TributeLetterTemplate.countDocuments({ isActive: true,isDeleted: false});
  
      res.status(200).json({
        tributeLetterTemplate,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTributeLetterTemplate / limit),
          totalItems: totalTributeLetterTemplate,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});
  
router.get("/letter-template/:id", async (req, res) => {
    const letterTemplateId = req.params.id;
  
    if (!mongoose.isValidObjectId(letterTemplateId)) {
      return res.status(400).send("Invalid tribute letter template ID");
    }
  
    try {
      const tributeLetterTemplate = await TributeLetterTemplate.findById(letterTemplateId);
      if (!tributeLetterTemplate) {
        return res.status(404).send("Tribute letter template not found");
      }
      res.status(200).send(tributeLetterTemplate);
    } catch (error) {
      res.status(500).send("Error retrieving the tribute letter template");
    }
});
  
router.delete("/letter-template/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const tributeLetterTemplate = await TributeLetterTemplate.findByIdAndUpdate(
        id,
        { isDeleted: true }, 
        { new: true }    
      );
  
      if (!tributeLetterTemplate) {
        return res.status(404).json({ message: "Tribute letter template not found" });
      }
  
      res.status(200).json("Tribute letter template marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

//Tribute Flower Type Item APIs

router.post("/flower-type", verifyTokenAndAdmin, async (req, res) => {
    let flowerTypeId;
  
    try {
      let flowerType = new TributeFlowerType({
        image: "TEMP",
        name: "TEMP"
      });
  
      flowerType = await flowerType.save({ validateBeforeSave: false });
      flowerTypeId = flowerType._id.toString();
  
      uploadAWS(flowerTypeId).fields([{ name: "image", maxCount: 1 }])(req, res, async (err) => {
        if (err) {
          await TributeFlowerType.findByIdAndDelete(flowerTypeId);
          return res.status(500).send("Flower type image upload failed");
        }
  
        req.body = sanitizeBodyKeys(req.body);
  
        try {
          if (typeof req.body.priceList === "string") {
            req.body.priceList = JSON.parse(req.body.priceList);
          }
  
          const updatedFlowerType = await updateFlowerType(flowerTypeId, req.body, req.files);
  
          if (!updatedFlowerType) {
            await TributeFlowerType.findByIdAndDelete(flowerTypeId);
            return res.status(500).send("Flower type update failed");
          }
  
          res.send(updatedFlowerType);
        } catch (updateErr) {
          console.error(updateErr);
          await TributeFlowerType.findByIdAndDelete(flowerTypeId);
          return res.status(500).send(updateErr.message || "Flower type update error");
        }
      });
    } catch (e) {
      console.error(e);
      if (flowerTypeId) {
        await TributeFlowerType.findByIdAndDelete(flowerTypeId);
      }
      return res.status(500).send("Failed to create flower type");
    }
});
  
router.post(`/flower-type/update`, verifyTokenAndAdmin, async (req, res) => {
    try {
      await uploadAWS(req.body.flowerTypeId).fields([
        { name: "image", maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) {
          return res.status(500).send("The tribute flower type cannot be updated");
        }
        let tributeFlowerType = await updateFlowerType(req.body.flowerTypeId, req.body, req.files);
        if (!tributeFlowerType) {
          return res.status(500).send("The tribute flower type cannot be updated");
        }
        res.send(tributeFlowerType);
      });
    } catch (e) {
      return res.status(500).send("The tribute flower type cannot be updated");
    }
});

router.get("/flower-type/all", verifyTokenAndAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
  
      const skip = (page - 1) * limit;
  
      const tributeFlowerType = await TributeFlowerType.find({ isDeleted: false })
        .skip(skip)
        .limit(limit);
  
      const totalTributeFlowerType = await TributeFlowerType.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        tributeFlowerType,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTributeFlowerType / limit),
          totalItems: totalTributeFlowerType,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});
  
router.get("/flower-type/active", async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
  
      const skip = (page - 1) * limit;
  
      const tributeFlowerType = await TributeFlowerType.find({ isActive: true,isDeleted: false })
        .skip(skip)
        .limit(limit);
  
      const totalTributeFlowerType = await TributeFlowerType.countDocuments({ isActive: true,isDeleted: false});
  
      res.status(200).json({
        tributeFlowerType,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalTributeFlowerType / limit),
          totalItems: totalTributeFlowerType,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});
  
router.get("/flower-type/:id", async (req, res) => {
    const flowerTypeId = req.params.id;
  
    if (!mongoose.isValidObjectId(flowerTypeId)) {
      return res.status(400).send("Invalid tribute flower type ID");
    }
  
    try {
      const tributeFlowerType = await TributeFlowerType.findById(flowerTypeId);
      if (!tributeFlowerType) {
        return res.status(404).send("Tribute flower type not found");
      }
      res.status(200).send(tributeFlowerType);
    } catch (error) {
      res.status(500).send("Error retrieving the tribute flower type");
    }
});
  
router.delete("/flower-type/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const tributeFlowerType = await TributeFlowerType.findByIdAndUpdate(
        id,
        { isDeleted: true }, 
        { new: true }    
      );
  
      if (!tributeFlowerType) {
        return res.status(404).json({ message: "Tribute flower type not found" });
      }
  
      res.status(200).json("Tribute flower type marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.post("/memory-pricing",verifyTokenAndAdmin, async (req, res) => {
  try {
    const pricing = new TributeMemoryPricing(req.body);
    const saved = await pricing.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/memory-pricing/all",verifyTokenAndAdmin, async (req, res) => {
  try {
    const result = await TributeMemoryPricing.find({ isDeleted: false }).populate("priceList.country");
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/memory-pricing/active", async (req, res) => {
  try {
    const result = await TributeMemoryPricing.find({ isDeleted: false, isActive: true }).populate("priceList.country");
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/memory-pricing/:countryId", async (req, res) => {
  const { countryId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(countryId)) {
    return res.status(400).json({ message: "Invalid country ID" });
  }

  try {
    const results = await TributeMemoryPricing.find({
      isDeleted: false,
      "priceList.country": countryId,
    }).populate("priceList.country");

    const filteredResults = results.map((item) => ({
      _id: item._id,
      name: item.name,
      isActive: item.isActive,
      priceList: item.priceList.filter(
        (entry) => entry.country._id.toString() === countryId
      ),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    res.json(filteredResults);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/memory-pricing/:id", async (req, res) => {
  try {
    const updated = await TributeMemoryPricing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/memory-pricing/:id",verifyTokenAndAdmin, async (req, res) => {
  try {
    const deleted = await TributeMemoryPricing.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Functions

async function updateCardTemplate(cardTemplateId,body,fileList) { 
    const updateData = {
      isDeleted: false,
      isActive: body.isActive !== undefined ? body.isActive : true,
      name:body.name,
      ...(fileList?.image?.[0] && { image: fileList.image[0].location }),
    };
  
    const updatedTributeCardTemplate = await TributeCardTemplate.findByIdAndUpdate(cardTemplateId, updateData, { new: true });
  
    return updatedTributeCardTemplate;
}

async function updateLetterTemplate(letterTemplateId,body,fileList) { 
    const updateData = {
      isDeleted: false,
      isActive: true,
      name:body.name,
      ...(fileList?.image?.[0] && { image: fileList.image[0].location }),
    };
  
    const updatedTributeLetterTemplate = await TributeLetterTemplate.findByIdAndUpdate(letterTemplateId, updateData, { new: true });
  
    return updatedTributeLetterTemplate;
}

async function updateFlowerType(flowerTypeId, body, fileList) {
  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    throw new Error("The 'name' field is required and must be a non-empty string.");
  }

  let parsedPriceList = [];

  if (typeof body.priceList === "string") {
    try {
      parsedPriceList = JSON.parse(body.priceList);
    } catch {
      throw new Error("Invalid JSON format in 'priceList'");
    }
  } else if (Array.isArray(body.priceList)) {
    parsedPriceList = body.priceList;
  } else {
    throw new Error("The 'priceList' must be provided as a JSON string or an array.");
  }

  if (
    !Array.isArray(parsedPriceList) ||
    parsedPriceList.length === 0 ||
    !parsedPriceList.every(item =>
      mongoose.isValidObjectId(item.country) &&
      typeof item.price === "number" &&
      item.price >= 0
    )
  ) {
    throw new Error("The 'priceList' must be a non-empty array with valid 'country' ObjectIds and 'price' values.");
  }

  const updateData = {
    name: body.name,
    isDeleted: false,
    isActive: body.isActive !== undefined ? body.isActive : true,
    priceList: parsedPriceList,
    ...(fileList?.image?.[0] && { image: fileList.image[0].location }),
  };

  const updatedFlowerType = await TributeFlowerType.findByIdAndUpdate(
    flowerTypeId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!updatedFlowerType) {
    throw new Error("Flower type not found or could not be updated.");
  }

  return updatedFlowerType;
} 
  
function sanitizeBodyKeys(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.trim(), v])
    );
}

module.exports = router;
