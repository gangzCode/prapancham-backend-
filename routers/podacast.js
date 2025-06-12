const { Podcast } = require("../models/podcast");
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { verifyToken, verifyTokenAndAuthorization, verifyTokenAndAdmin } = require("./verifyToken");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { Constants } = require("../models/constants");
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

const uploadAWS = (youtubeNewsId) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${youtubeNewsId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
});

const uploadOptions = multer({ storage: storage });


router.post("/", verifyTokenAndAdmin, async (req, res) => {
  let podcastId;

  try {
    let podcast = new Podcast({
      title: { en: [], ta: [], si: [] },
      description: { en: [], ta: [], si: [] },
      creatorName: { en: [], ta: [], si: [] },
      podcastLink:"TEMP",
      podcastRunTime:"TEMP",
      podcastCategory:"TEMP"
    });

    podcast = await podcast.save({ validateBeforeSave: false });
    podcastId = podcast._id.toString();

    uploadAWS(podcastId).fields([
      { name: "image", maxCount: 1 },
    ])(req, res, async (err) => {
      if (err) {
        await Podcast.findByIdAndDelete(podcastId);
        return res.status(500).send("Image upload failed");
      }

      req.body = sanitizeBodyKeys(req.body);

      try {
        const updatedPodcast = await updatePodcast(podcastId, req.body, req.files);
        if (!updatedPodcast) {
          await Podcast.findByIdAndDelete(podcastId);
          return res.status(500).send("Podcast update failed");
        }

        res.send(updatedPodcast);
      } catch (updateErr) {
        await Podcast.findByIdAndDelete(podcastId);
        return res.status(500).send(updateErr.message || "Podcast update error");
      }
    });

  } catch (e) {
    if (podcastId) {
      await YoutubeNews.findByIdAndDelete(podcastId);
    }
    return res.status(500).send("Failed to create podcast");
  }
});

router.post("/update", verifyTokenAndAdmin, async (req, res) => {
    try {
      await uploadAWS(req.body.podcastId).fields([
        { name: "image", maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) {
          return res.status(500).send("The podcast cannot be updated");
        }
  
        const podcast = await updatePodcast(req.body.podcastId, req.body, req.files);
        if (!podcast) {
          return res.status(500).send("The podcast cannot be updated");
        }
  
        res.send(podcast);
      });
    } catch (e) {
      return res.status(500).send("The podcast cannot be updated");
    }
});

router.get("/active", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const podcast = await Podcast.find({ isActive: true, isDeleted: false })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Podcast.countDocuments({ isActive: true, isDeleted: false });

    res.status(200).json({
      podcast,
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
    const podcast = await Podcast.find({ isDeleted: false })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Podcast.countDocuments({ isDeleted: false });

    res.status(200).json({
      podcast,
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

router.get('/', async (req, res) => {
  const { category } = req.query;

  try {
    if (!category) {
      return res.status(400).json({ message: "Category is required in query" });
    }

    const podcasts = await Podcast.find({
      podcastCategory: category,
      isDeleted: false,
      isActive: true
    }).sort({ createdAt: -1 }); // Optional: sort newest first

    res.json(podcasts);
  } catch (err) {
    console.error('Error fetching podcasts by category:', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/recent/:limit", async (req, res) => {
  const limit = parseInt(req.params.limit) || 5;

  try {
    const recentPodcast = await Podcast.find({
      isActive: true,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json(recentPodcast);
  } catch (err) {
    console.error("Error fetching recent podcast:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await Podcast.distinct('podcastCategory', {
      podcastCategory: { $ne: null }, // exclude null
      isDeleted: false,
      isActive: true,
    });

    res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching podcast categories:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get("/:id", async (req, res) => {
  const podcastId = req.params.id;

  if (!mongoose.isValidObjectId(podcastId)) {
    return res.status(400).send("Invalid youtube ID");
  }

  try {
    const podcast = await Podcast.findById(podcastId);
    if (!podcast) {
      return res.status(404).send("Podcast not found");
    }
    res.status(200).send(podcast);
  } catch (error) {
    res.status(500).send("Error retrieving the podcast");
  }
});

router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const podcast = await Podcast.findByIdAndUpdate(
        id,
        { isDeleted: true }, 
        { new: true }    
      );
  
      if (!podcast) {
        return res.status(404).json({ message: "Podcast news not found" });
      }
  
      res.status(200).json("Podcast marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

async function updatePodcast(podcastId, data, fileList) {
  if (!data.title || !data.description || !data.podcastLink || !data.podcastRunTime || !data.podcastCategory) throw new Error("Name, podcast category,podcast link, podcast runtime and description are required");

  let title = data.title;
  let description = data.description;
  let creatorName = data.creatorName;
  let podcastLink = data.podcastLink;
  let podcastRunTime = data.podcastRunTime;
  let podcastCategory = data.podcastCategory;

  try {
  if (typeof title === "string") title = JSON.parse(title);
  if (typeof description === "string") description = JSON.parse(description);
  if (typeof creatorName === "string") creatorName = JSON.parse(creatorName);
  } catch (e) {
  throw new Error("Invalid JSON in name, podcast link, podcast runtime or description, category");
  }

  const updateData = {
    title,
    description,
    creatorName,
    podcastLink,
    podcastRunTime,
    podcastCategory,
    isFeatured: data.isFeatured || false,
    isActive: data.isActive !== undefined ? data.isActive : true,
    isDeleted: false,
    ...(fileList && fileList.image && fileList.image[0] && { image: fileList.image[0].location }),
  };

  const updatedPodcast = await Podcast.findByIdAndUpdate(podcastId, updateData, { new: true });
  return updatedPodcast;
}
  
function sanitizeBodyKeys(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.trim(), v])
    );
}
  
module.exports = router;