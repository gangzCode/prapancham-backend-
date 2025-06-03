const express = require("express");
const router = express.Router();
const { ObituaryRemembarancePackages } = require("../models/obituaryRemembarance-packages");
const { verifyTokenAndAdmin } = require("./verifyToken");
const { Addons } = require("../models/addons");
const { ObituraryPostBgColor } = require("../models/obituraryPostBgColor");
const { ObituraryPostPrimaryImageFrame } = require("../models/obituraryPostPrimaryImageFrame");
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

// Bg Color APIs

router.post("/bg-color", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { name,colorCode, isActive } = req.body;

    const newBgColor = new ObituraryPostBgColor({ name,colorCode, isActive});

    const savedBgColor = await newBgColor.save();
    res.status(201).json(savedBgColor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/bg-color/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name,colorCode, isActive } = req.body;

    const updatedBgColor = await ObituraryPostBgColor.findByIdAndUpdate(
      id,
      {name,colorCode, isActive},
      { new: true, runValidators: true }
    );

    if (!updatedBgColor) {
      return res.status(404).json({ message: "Bg Color not found" });
    }

    res.status(200).json(updatedBgColor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/bg-color/all", verifyTokenAndAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const bgColor = await ObituraryPostBgColor.find({ isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalBgColor = await ObituraryPostBgColor.countDocuments({ isDeleted: false });

    res.status(200).json({
      bgColor,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalBgColor / limit),
        totalItems: totalBgColor,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/bg-color/active", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const bgColor = await ObituraryPostBgColor.find({ isActive: true,isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalbgColor = await ObituraryPostBgColor.countDocuments({ isActive: true,isDeleted: false });

    res.status(200).json({
      bgColor,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalbgColor / limit),
        totalItems: totalbgColor,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/bg-color/:id", async (req, res) => {
  const bgColorId = req.params.id;

  if (!mongoose.isValidObjectId(bgColorId)) {
    return res.status(400).send("Invalid bg color ID");
  }

  try {
    const bgColor = await ObituraryPostBgColor.findById(bgColorId);
    if (!bgColor) {
      return res.status(404).send("Bg color not found");
    }
    res.status(200).send(bgColor);
  } catch (error) {
    res.status(500).send("Error retrieving the bg color");
  }
});

router.delete("/bg-color/:id",verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const bgColor = await ObituraryPostBgColor.findByIdAndUpdate(
      id,
      { isDeleted: true }, 
      { new: true }    
    );

    if (!bgColor) {
      return res.status(404).json({ message: "Bg color not found" });
    }

    res.status(200).json("Bg color marked as deleted");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Bg Frame APIs

router.post("/bg-frame", verifyTokenAndAdmin, async (req, res) => {
  let bgFrameId;
  
    try {
      // First: Create a placeholder bg frame to get an _id
      let bgFrame = new ObituraryPostPrimaryImageFrame({
        frameImage: "TEMP",
      });
  
      bgFrame = await bgFrame.save({ validateBeforeSave: false });
      bgFrameId = bgFrame._id.toString();
  
      uploadAWS(bgFrameId).fields([{ name: "frameImage", maxCount: 1 }])(req, res, async (err) => {
        if (err) {
          await ObituraryPostPrimaryImageFrame.findByIdAndDelete(bgFrameId);
          return res.status(500).send("Bg frame image upload failed");
        }

        req.body = sanitizeBodyKeys(req.body);
  
        try {
          const updatedBgFrame = await updateBgFrame(bgFrameId, req.body, req.files);
          
          if (!updatedBgFrame) {
            await ObituraryPostPrimaryImageFrame.findByIdAndDelete(bgFrameId);
            return res.status(500).send("Bg frame update failed");
          }
  
          res.send(updatedBgFrame);
        } catch (updateErr) {
          console.error(updateErr);
          await ObituraryPostPrimaryImageFrame.findByIdAndDelete(bgFrameId);
          return res.status(500).send(updateErr.message || "Bg frame update error");
        }
      });
  
    } catch (e) {
      console.error(e);
      if (bgFrameId) {
        await ObituraryPostPrimaryImageFrame.findByIdAndDelete(bgFrameId);
      }
      return res.status(500).send("Failed to create bg frame");
    }
});

router.post(`/bg-frame/update`, verifyTokenAndAdmin, async (req, res) => {
  try {
    await uploadAWS(req.body.bgFrameId).fields([
      { name: "frameImage", maxCount: 1 },
    ])(req, res, async (err) => {
      if (err) {
        return res.status(500).send("The bg frame cannot be updated");
      }
      let bgFrame = await updateBgFrame(req.body.bgFrameId, req.body, req.files);
      if (!bgFrame) {
        return res.status(500).send("The bg frame cannot be updated");
      }
      res.send(bgFrame);
    });
  } catch (e) {
    return res.status(500).send("The bg frame cannot be updated");
  }
});

router.get("/bg-frame/all", verifyTokenAndAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const bgFrames = await ObituraryPostPrimaryImageFrame.find({ isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalBgFrames = await ObituraryPostPrimaryImageFrame.countDocuments({ isDeleted: false });

    res.status(200).json({
      bgFrames,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalBgFrames / limit),
        totalItems: totalBgFrames,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/bg-frame/active", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const bgFrame = await ObituraryPostPrimaryImageFrame.find({ isActive: true,isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalBgFrames = await ObituraryPostPrimaryImageFrame.countDocuments({ isActive: true,isDeleted: false});

    res.status(200).json({
      bgFrame,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalBgFrames / limit),
        totalItems: totalBgFrames,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/bg-frame/:id", async (req, res) => {
  const bgFrameId = req.params.id;

  if (!mongoose.isValidObjectId(bgFrameId)) {
    return res.status(400).send("Invalid bg frame ID");
  }

  try {
    const bgFrame = await ObituraryPostPrimaryImageFrame.findById(bgFrameId);
    if (!bgFrame) {
      return res.status(404).send("Bg Frame not found");
    }
    res.status(200).send(bgFrame);
  } catch (error) {
    res.status(500).send("Error retrieving the bg frame");
  }
});

router.delete("/bg-frame/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const bgFrame = await ObituraryPostPrimaryImageFrame.findByIdAndUpdate(
      id,
      { isDeleted: true }, 
      { new: true }    
    );

    if (!bgFrame) {
      return res.status(404).json({ message: "Bg Frame not found" });
    }

    res.status(200).json("Bg Frame marked as deleted");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Obituary or Remembarance Packages Addons

router.post("/addons", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { name, priceList,isActive } = req.body;

    const newAddons = new Addons({ name, priceList,isActive});

    const savedAddons = await newAddons.save();
    res.status(201).json(savedAddons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/addons/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, priceList,isActive } = req.body;

    const updatedAddons = await Addons.findByIdAndUpdate(
      id,
      { name, priceList,isActive },
      { new: true, runValidators: true }
    );

    if (!updatedAddons) {
      return res.status(404).json({ message: "Addons not found" });
    }

    res.status(200).json(updatedAddons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/addons/all", verifyTokenAndAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const addons = await Addons.find({ isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalAddons = await Addons.countDocuments({ isDeleted: false });

    res.status(200).json({
      addons,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalAddons / limit),
        totalItems: totalAddons,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/addons/active", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const addons = await Addons.find({ isActive: true,isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalAddons = await Addons.countDocuments({ isActive: true,isDeleted: false });

    res.status(200).json({
      addons,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalAddons / limit),
        totalItems: totalAddons,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/addons/:id", async (req, res) => {
  const addonsId = req.params.id;

  if (!mongoose.isValidObjectId(addonsId)) {
    return res.status(400).send("Invalid addon ID");
  }

  try {
    const addon = await Addons.findById(addonsId);
    if (!addon) {
      return res.status(404).send("Addon not found");
    }
    res.status(200).send(addon);
  } catch (error) {
    res.status(500).send("Error retrieving the addon");
  }
});

router.delete("/addons/:id",verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const addon = await Addons.findByIdAndUpdate(
      id,
      { isDeleted: true }, 
      { new: true }    
    );

    if (!addon) {
      return res.status(404).json({ message: "Addon not found" });
    }

    res.status(200).json("Addon marked as deleted");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Obituary or Remembarance Packages APIs

router.post('/', verifyTokenAndAdmin, async (req, res) => {
  try {
    const {
      name,
      addons,
      isObituary,
      isRemembarace,
      isPremium,
      price,
      duration,
      description,
      wordLimit,
      priceList,
      isTributeVideoUploading,
      isAdditionalImages,
      noofAdditionalImages,
      noofContectDetails,
      noofBgColors,
      bgColors,
      noofPrimaryImageBgFrames,
      primaryImageBgFrames,
      isActive
    } = req.body;

    const uniqueAddons = [...new Set(addons)];
    if (uniqueAddons.length !== addons.length) {
      return res.status(400).json({ success: false, message: "Duplicate addons are not allowed." });
    }

    const existingAddons = await Addons.find({ _id: { $in: uniqueAddons }, isDeleted: false });
    if (existingAddons.length !== uniqueAddons.length) {
      return res.status(400).json({ success: false, message: "One or more addons are invalid or deleted." });
    }

    const uniqueBgColors = bgColors ? [...new Set(bgColors)] : [];

    if (uniqueBgColors.length !== (bgColors?.length || 0)) {
      return res.status(400).json({ success: false, message: "Duplicate background colors are not allowed." });
    }

    if (noofBgColors != null && uniqueBgColors.length > noofBgColors) {
      return res.status(400).json({
        success: false,
        message: `You can select at most ${noofBgColors} background color(s).`
      });
    }

    const existingBgColors = await ObituraryPostBgColor.find({ _id: { $in: uniqueBgColors } });
    if (existingBgColors.length !== uniqueBgColors.length) {
      return res.status(400).json({ success: false, message: "One or more background colors are invalid." });
    }

    const uniquePrimaryImageFrames = primaryImageBgFrames ? [...new Set(primaryImageBgFrames)] : [];

    if (uniquePrimaryImageFrames.length !== (primaryImageBgFrames?.length || 0)) {
      return res.status(400).json({ success: false, message: "Duplicate primary image frames are not allowed." });
    }

    if (noofPrimaryImageBgFrames != null && uniquePrimaryImageFrames.length > noofPrimaryImageBgFrames) {
      return res.status(400).json({
        success: false,
        message: `You can select at most ${noofPrimaryImageBgFrames} primary image frame(s).`
      });
    }

    const existingPrimaryFrames = await ObituraryPostPrimaryImageFrame.find({
      _id: { $in: uniquePrimaryImageFrames }
    });

    if (existingPrimaryFrames.length !== uniquePrimaryImageFrames.length) {
      return res.status(400).json({ success: false, message: "One or more primary image frames are invalid." });
    }

    const newPackage = new ObituaryRemembarancePackages({
      name,
      addons: uniqueAddons,
      isObituary,
      isRemembarace,
      isPremium,
      price,
      duration,
      description,
      wordLimit,
      priceList,
      isTributeVideoUploading,
      isAdditionalImages,
      noofAdditionalImages,
      noofContectDetails,
      noofBgColors,
      bgColors: uniqueBgColors,
      noofPrimaryImageBgFrames,
      primaryImageBgFrames: uniquePrimaryImageFrames,
      isActive
    });

    const savedPackage = await newPackage.save();
    res.status(201).json({ success: true, data: savedPackage });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      addons,
      isObituary,
      isRemembarace,
      isPremium,
      price,
      duration,
      description,
      wordLimit,
      priceList,
      isTributeVideoUploading,
      isAdditionalImages,
      noofAdditionalImages,
      noofContectDetails,
      noofBgColors,
      bgColors,
      noofPrimaryImageBgFrames,
      primaryImageBgFrames,
      isActive
    } = req.body;

    const uniqueAddons = [...new Set(addons)];
    if (uniqueAddons.length !== addons.length) {
      return res.status(400).json({ success: false, message: "Duplicate addons are not allowed." });
    }

    const existingAddons = await Addons.find({ _id: { $in: uniqueAddons }, isDeleted: false });
    if (existingAddons.length !== uniqueAddons.length) {
      return res.status(400).json({ success: false, message: "One or more addons are invalid or deleted." });
    }

    const uniqueBgColors = bgColors ? [...new Set(bgColors)] : [];

    if (uniqueBgColors.length !== (bgColors?.length || 0)) {
      return res.status(400).json({ success: false, message: "Duplicate background colors are not allowed." });
    }

    if (noofBgColors != null && uniqueBgColors.length > noofBgColors) {
      return res.status(400).json({
        success: false,
        message: `You can select at most ${noofBgColors} background color(s).`
      });
    }

    const existingBgColors = await ObituraryPostBgColor.find({ _id: { $in: uniqueBgColors } });
    if (existingBgColors.length !== uniqueBgColors.length) {
      return res.status(400).json({ success: false, message: "One or more background colors are invalid." });
    }

    const uniquePrimaryImageFrames = primaryImageBgFrames ? [...new Set(primaryImageBgFrames)] : [];

    if (uniquePrimaryImageFrames.length !== (primaryImageBgFrames?.length || 0)) {
      return res.status(400).json({ success: false, message: "Duplicate primary image frames are not allowed." });
    }

    if (noofPrimaryImageBgFrames != null && uniquePrimaryImageFrames.length > noofPrimaryImageBgFrames) {
      return res.status(400).json({
        success: false,
        message: `You can select at most ${noofPrimaryImageBgFrames} primary image frame(s).`
      });
    }

    const existingPrimaryFrames = await ObituraryPostPrimaryImageFrame.find({
      _id: { $in: uniquePrimaryImageFrames }
    });

    if (existingPrimaryFrames.length !== uniquePrimaryImageFrames.length) {
      return res.status(400).json({ success: false, message: "One or more primary image frames are invalid." });
    }

    // ✅ Update the package
    const updatedPackage = await ObituaryRemembarancePackages.findByIdAndUpdate(
      id,
      {
        name,
        addons: uniqueAddons,
        isObituary,
        isRemembarace,
        isPremium,
        price,
        duration,
        description,
        wordLimit,
        priceList,
        isTributeVideoUploading,
        isAdditionalImages,
        noofAdditionalImages,
        noofContectDetails,
        noofBgColors,
        bgColors: uniqueBgColors,
        noofPrimaryImageBgFrames,
        primaryImageBgFrames: uniquePrimaryImageFrames,
        isActive
      },
      { new: true, runValidators: true }
    );

    if (!updatedPackage) {
      return res.status(404).json({ success: false, message: "Package not found." });
    }

    res.status(200).json({ success: true, data: updatedPackage });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/all", verifyTokenAndAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const obituaryRemembarancePackages = await ObituaryRemembarancePackages.find({ isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalObituaryRemembarancePackages = await ObituaryRemembarancePackages.countDocuments({ isDeleted: false });

    res.status(200).json({
      obituaryRemembarancePackages,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalObituaryRemembarancePackages / limit),
        totalItems: totalObituaryRemembarancePackages,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/active", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const obituaryRemembarancePackages = await ObituaryRemembarancePackages.find({ isActive: true,isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalObituaryRemembarancePackages = await ObituaryRemembarancePackages.countDocuments({ isActive: true,isDeleted: false });

    res.status(200).json({
      obituaryRemembarancePackages,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalObituaryRemembarancePackages / limit),
        totalItems: totalObituaryRemembarancePackages,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  const obituaryRemembarancePackagesId = req.params.id;

  if (!mongoose.isValidObjectId(obituaryRemembarancePackagesId)) {
    return res.status(400).send("Invalid obituary or remembarance package ID");
  }

  try {
    const obituaryRemembarancePackage = await ObituaryRemembarancePackages.findById(obituaryRemembarancePackagesId);
    if (!obituaryRemembarancePackage) {
      return res.status(404).send("Obituary or remembarance package not found");
    }
    res.status(200).send(obituaryRemembarancePackage);
  } catch (error) {
    res.status(500).send("Error retrieving the obituary or remembarance package");
  }
});

router.delete("/:id",verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const obituaryRemembarancePackage = await ObituaryRemembarancePackages.findByIdAndUpdate(
      id,
      { isDeleted: true }, 
      { new: true }    
    );

    if (!obituaryRemembarancePackage) {
      return res.status(404).json({ message: "Obituary or remembarance packag not found" });
    }

    res.status(200).json("Obituary or remembarance packag marked as deleted");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function updateBgFrame(bgFrameId,body,fileList) { 
  const updateData = {
    isDeleted: false,
    isActive: true,
    ...(fileList?.frameImage?.[0] && { frameImage: fileList.frameImage[0].location }),
    ...body
  };

  const updatedBgFrame = await ObituraryPostPrimaryImageFrame.findByIdAndUpdate(bgFrameId, updateData, { new: true });

  return updatedBgFrame;
}

function sanitizeBodyKeys(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.trim(), v])
  );
}

module.exports = router;
