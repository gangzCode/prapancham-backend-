const { YoutubeNews } = require("../models/youtubeNews");
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
  let youtubeNewsId;

  try {
    let youtubeNews = new YoutubeNews({
      title: { en: [], ta: [], si: [] },
      description: { en: [], ta: [], si: [] },
      youtubeRunTime:"TEMP",
      youtubeLink:"TEMP"
    });

    youtubeNews = await youtubeNews.save({ validateBeforeSave: false });
    youtubeNewsId = youtubeNews._id.toString();

    uploadAWS(youtubeNewsId).fields([
      { name: "image", maxCount: 1 },
      { name: "featuredYoutubeImage", maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        await YoutubeNews.findByIdAndDelete(youtubeNewsId);
        return res.status(500).send("Image upload failed");
      }

      req.body = sanitizeBodyKeys(req.body);

      try {
        const updatedYoutubeNews = await updateYoutubeNews(youtubeNewsId, req.body, req.files);
        if (!updatedYoutubeNews) {
          await YoutubeNews.findByIdAndDelete(youtubeNewsId);
          return res.status(500).send("Youtube update failed");
        }

        res.send(updatedYoutubeNews);
      } catch (updateErr) {
        await YoutubeNews.findByIdAndDelete(youtubeNewsId);
        return res.status(500).send(updateErr.message || "Youtube update error");
      }
    });

  } catch (e) {
    if (youtubeNewsId) {
      await YoutubeNews.findByIdAndDelete(youtubeNewsId);
    }
    return res.status(500).send("Failed to create youtube news");
  }
});

router.post("/update", verifyTokenAndAdmin, async (req, res) => {
    try {
      await uploadAWS(req.body.youtubeNewsId).fields([
        { name: "image", maxCount: 1 },
        { name: "featuredYoutubeImage", maxCount: 1 }
      ])(req, res, async (err) => {
        if (err) {
          return res.status(500).send("The youtube news cannot be updated");
        }
  
        const youtubeNews = await updateYoutubeNews(req.body.youtubeNewsId, req.body, req.files);
        if (!youtubeNews) {
          return res.status(500).send("The youtube news cannot be updated");
        }
  
        res.send(youtubeNews);
      });
    } catch (e) {
      return res.status(500).send("The youtube news cannot be updated");
    }
});

router.get("/active", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const youtubeNews = await YoutubeNews.find({ isActive: true, isDeleted: false })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await YoutubeNews.countDocuments({ isActive: true, isDeleted: false });

    res.status(200).json({
      youtubeNews,
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
    const youtubeNews = await YoutubeNews.find({ isDeleted: false })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await YoutubeNews.countDocuments({ isDeleted: false });

    res.status(200).json({
      youtubeNews,
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
    const recentYoutubeNews = await YoutubeNews.find({
      isActive: true,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json(recentYoutubeNews);
  } catch (err) {
    console.error("Error fetching recent youtube news:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  const youtubeNewsId = req.params.id;

  if (!mongoose.isValidObjectId(youtubeNewsId)) {
    return res.status(400).send("Invalid youtube ID");
  }

  try {
    const youtubeNews = await YoutubeNews.findById(youtubeNewsId);
    if (!youtubeNews) {
      return res.status(404).send("Youtube not found");
    }
    res.status(200).send(youtubeNews);
  } catch (error) {
    res.status(500).send("Error retrieving the youtube news");
  }
});

router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const youtubeNews = await YoutubeNews.findByIdAndUpdate(
        id,
        { isDeleted: true }, 
        { new: true }    
      );
  
      if (!youtubeNews) {
        return res.status(404).json({ message: "Youtube news not found" });
      }
  
      res.status(200).json("Youtube news marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

async function updateYoutubeNews(youtubeNewsId, data, fileList) {
  if (!data.title || !data.description || !data.youtubeLink || !data.youtubeRunTime) throw new Error("Name,youtube link, youtube runtime and description are required");

  let title = data.title;
  let description = data.description;
  let youtubeLink = data.youtubeLink;
  let youtubeRunTime = data.youtubeRunTime;

  try {
  if (typeof title === "string") title = JSON.parse(title);
  if (typeof description === "string") description = JSON.parse(description);
  if (typeof youtubeLink === "string") youtubeLink = JSON.parse(youtubeLink);
  if (typeof youtubeRunTime === "string") youtubeRunTime = JSON.parse(youtubeRunTime);
  } catch (e) {
  throw new Error("Invalid JSON in name, youtube link, youtube runtime or description");
  }

  const updateData = {
    title,
    description,
    youtubeLink,
    youtubeRunTime,
    isFeatured: data.isFeatured || false,
    isActive: data.isActive !== undefined ? data.isActive : true,
    isDeleted: false,
    ...(fileList && fileList.image && fileList.image[0] && { image: fileList.image[0].location }),
    ...(fileList &&
      fileList.featuredYoutubeImage &&
      fileList.featuredYoutubeImage[0] && { featuredYoutubeImage: fileList.featuredYoutubeImage[0].location }),
  };

  const updatedYoutubeNews = await YoutubeNews.findByIdAndUpdate(youtubeNewsId, updateData, { new: true });
  return updatedYoutubeNews;
}
  
function sanitizeBodyKeys(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.trim(), v])
    );
}
  
module.exports = router;