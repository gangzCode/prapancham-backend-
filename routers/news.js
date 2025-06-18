const { News } = require("../models/news");
const { NewsCategory } = require("../models/newsCategory");
const { YouTubeNews } = require("../models/youtubeNews");
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

const uploadAWS = (newsId) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${newsId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
});

const uploadOptions = multer({ storage: storage });


router.post("/news-category", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { name, isDeleted = false, isActive = true } = req.body;

    if (!name?.en || !name?.ta || !name?.si) {
      return res.status(400).json({ message: "All language fields (english, tamil, sinhala) are required." });
    }

    const newCategory = new NewsCategory({
      name,
      isDeleted,
      isActive,
    });

    const savedCategory = await newCategory.save();
    res.status(201).json(savedCategory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/news-category/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isDeleted, isActive } = req.body;

    const updatedCategory = await NewsCategory.findByIdAndUpdate(
      id,
      { name, isDeleted, isActive },
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "News Category not found" });
    }

    res.status(200).json(updatedCategory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/news-category/active", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const newsCategory = await NewsCategory.find({ isActive: true, isDeleted: false })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await NewsCategory.countDocuments({ isActive: true, isDeleted: false });

    res.status(200).json({
      newsCategory,
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

router.get("/news-category/all", verifyTokenAndAdmin, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const newsCategory = await NewsCategory.find({ isDeleted: false })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await NewsCategory.countDocuments({ isDeleted: false });

    res.status(200).json({
      newsCategory,
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

router.get("/news-category/:id", async (req, res) => {
  const newsCategoryId = req.params.id;

  if (!mongoose.isValidObjectId(newsCategoryId)) {
    return res.status(400).send("Invalid News Category ID");
  }

  try {
    const newsCategory = await NewsCategory.findById(newsCategoryId);
    if (!newsCategory) {
      return res.status(404).send("News Category not found");
    }
    res.status(200).send(newsCategory);
  } catch (error) {
    res.status(500).send("Error retrieving the news category");
  }
});

router.delete("/news-category/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const event = await NewsCategory.findByIdAndUpdate(
      id,
      { isDeleted: true }, 
      { new: true }    
    );

    if (!event) {
      return res.status(404).json({ message: "News Category not found" });
    }

    res.status(200).json("News category marked as deleted");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", verifyTokenAndAdmin, async (req, res) => {
  let newsId;

  try {
    let news = new News({
      title: { en: [], ta: [], si: [] },
      description: { en: [], ta: [], si: [] },
      editorName: { en: [], ta: [], si: [] },
      paragraphs: [],
    });

    news = await news.save({ validateBeforeSave: false });
    newsId = news._id.toString();

    uploadAWS(newsId).fields([
      { name: "thumbnailImage", maxCount: 1 },
      { name: "mainImage", maxCount: 1 },
      { name: "otherImages", maxCount: 3 }
    ])(req, res, async (err) => {
      if (err) {
        await News.findByIdAndDelete(newsId);
        return res.status(500).send("Image upload failed");
      }

      req.body = sanitizeBodyKeys(req.body);

      try {
        const updatedNews = await updateNews(newsId, req.body, req.files);
        if (!updatedNews) {
          await News.findByIdAndDelete(newsId);
          return res.status(500).send("News update failed");
        }

        res.send(updatedNews);
      } catch (updateErr) {
        await News.findByIdAndDelete(newsId);
        return res.status(500).send(updateErr.message || "News update error");
      }
    });

  } catch (e) {
    if (newsId) {
      await News.findByIdAndDelete(newsId);
    }
    return res.status(500).send("Failed to create news");
  }
});

router.post("/update", verifyTokenAndAdmin, async (req, res) => {
  try {
    await uploadAWS(req.body.newsId).fields([
      { name: "thumbnailImage", maxCount: 1 },
      { name: "mainImage", maxCount: 1 },
      { name: "otherImages", maxCount: 3 }
    ])(req, res, async (err) => {
      if (err) return res.status(500).send("The news cannot be updated");

      const news = await updateNews(req.body.newsId, req.body, req.files);
      if (!news) return res.status(500).send("The news cannot be updated");

      res.send(news);
    });
  } catch (e) {
    return res.status(500).send("The news cannot be updated");
  }
});
  
router.get("/active", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
  
    try {
      const news = await News.find({ isActive: true, isDeleted: false })
        .populate("newsCategory")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const total = await News.countDocuments({ isActive: true, isDeleted: false });
  
      res.status(200).json({
        news,
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

router.get("/breaking-news/:limit", async (req, res) => {
  const limit = parseInt(req.params.limit) || 5;

  try {
    const breakingNews = await News.find({
      isActive: true,
      isDeleted: false,
      isBreakingNews: true,
    })
      .populate("newsCategory")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json(breakingNews);
  } catch (err) {
    console.error("Error fetching breaking news:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/important-news/:limit", async (req, res) => {
  const limit = parseInt(req.params.limit) || 5;

  try {
    const importantNews = await News.find({
      isActive: true,
      isDeleted: false,
      isImportantNews: true,
    })
      .populate("newsCategory")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json(importantNews);
  } catch (err) {
    console.error("Error fetching important news:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/recent/:limit", async (req, res) => {
  const limit = parseInt(req.params.limit) || 5;

  try {
    const recentNews = await News.find({
      isActive: true,
      isDeleted: false,
    })
      .populate("newsCategory")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json(recentNews);
  } catch (err) {
    console.error("Error fetching recent news:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/grouped-by-category", async (req, res) => {
  try {
    const categories = await NewsCategory.find({ isDeleted: false, isActive: true });

    const result = [];

    for (const category of categories) {
      const newsItems = await News.find({
        newsCategory: category._id,
        isDeleted: false,
        isActive: true,
      })
        .populate("newsCategory")
        .sort({ createdAt: -1 })
        .limit(3);

      if (newsItems.length > 0) {
        result.push({
          category,
          news: newsItems,
        });
      }
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching grouped news:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.get("/all", verifyTokenAndAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;     
    const limit = parseInt(req.query.limit) || 10;  
    const skip = (page - 1) * limit;
  
    try {
      const news = await News.find({ isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const total = await News.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        news,
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

router.get("/by-category/:categoryId", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { categoryId } = req.params;
  const { createdAt } = req.query;

  const filter = {
    isDeleted: false,
    newsCategory: categoryId,
  };

  // Filter by specific createdAt date (ignores time)
  if (createdAt) {
    const start = new Date(createdAt);
    const end = new Date(createdAt);
    end.setUTCHours(23, 59, 59, 999);
    start.setUTCHours(0, 0, 0, 0);
    filter.createdAt = { $gte: start, $lte: end };
  }

  try {
    const news = await News.find(filter)
      .skip(skip)
      .limit(limit)
      .populate("newsCategory")
      .sort({ createdAt: -1 });

    const total = await News.countDocuments(filter);

    res.status(200).json({
      data: news,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  const newsId = req.params.id;

  if (!mongoose.isValidObjectId(newsId)) {
    return res.status(400).send("Invalid News ID");
  }

  try {
    // 1. Get the requested news item
    const news = await News.findById(newsId).populate("newsCategory");
    if (!news) {
      return res.status(404).send("News not found");
    }

    const categoryId = news.newsCategory?._id;

    // 2. Find 3 other news from the same category (excluding the current one)
    const relatedNews = await News.find({
      _id: { $ne: news._id },
      newsCategory: categoryId,
      isDeleted: false,
      isActive: true,
    })
      .populate("newsCategory")
      .sort({ createdAt: -1 })
      .limit(3);

    // 3. Find 3 news from a different category
    const differentCategoryNews = await News.find({
      _id: { $ne: news._id },
      newsCategory: { $ne: categoryId },
      isDeleted: false,
      isActive: true,
    })
      .populate("newsCategory")
      .sort({ createdAt: -1 })
      .limit(3);

    res.status(200).json({
      success: true,
      news,
      relatedNews,
      differentCategoryNews,
    });
  } catch (error) {
    console.error("Error retrieving the news:", error);
    res.status(500).send("Error retrieving the news");
  }
});

router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const news = await News.findByIdAndUpdate(
        id,
        { isDeleted: true }, 
        { new: true }    
      );
  
      if (!news) {
        return res.status(404).json({ message: "News not found" });
      }
  
      res.status(200).json("News marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});
  
async function updateNews(newsId, data, fileList) {
  if (!data.title || !data.description || !data.editorName)
    throw new Error("Title, description, and editor name are required");

  let title = data.title;
  let description = data.description;
  let editorName = data.editorName;
  let paragraphs = data.paragraphs;

  try {
    if (typeof title === "string") title = JSON.parse(title);
    if (typeof description === "string") description = JSON.parse(description);
    if (typeof editorName === "string") editorName = JSON.parse(editorName);
    if (typeof paragraphs === "string") paragraphs = JSON.parse(paragraphs);
  } catch (e) {
    throw new Error("Invalid JSON format in fields");
  }

  let newsCategoryId = data.newsCategory || null;

  if (newsCategoryId) {
    const category = await NewsCategory.findOne({
      _id: newsCategoryId,
      isDeleted: false,
      isActive: true,
    });

    if (!category) {
      throw new Error("Invalid or inactive news category");
    }
  }

  const updateData = {
    title,
    description,
    editorName,
    paragraphs: Array.isArray(paragraphs) ? paragraphs : [],
    isBreakingNews: data.isBreakingNews || false,
    isImportantNews: data.isImportantNews || false,
    isActive: data.isActive !== undefined ? data.isActive : true,
    isDeleted: false,
    newsCategory: newsCategoryId,
    ...(fileList?.thumbnailImage?.[0] && { thumbnailImage: fileList.thumbnailImage[0].location }),
    ...(fileList?.mainImage?.[0] && { mainImage: fileList.mainImage[0].location }),
    ...(fileList?.otherImages && {
      otherImages: fileList.otherImages.map((img) => img.location)
    })
  };

  const updatedNews = await News.findByIdAndUpdate(newsId, updateData, { new: true });
  return updatedNews;
}
  
function sanitizeBodyKeys(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.trim(), v])
    );
}
  
module.exports = router;