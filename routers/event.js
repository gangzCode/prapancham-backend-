const { Event } = require("../models/event");
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

const uploadAWS = (eventId) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${eventId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
});

const uploadOptions = multer({ storage: storage });

router.post("/", verifyTokenAndAdmin, async (req, res) => {
    let eventId;
  
    try {
      let event = new Event({
        name: { en: [], ta: [], si: [] },
        description: { en: [], ta: [], si: [] },
        eventDate: "TEMP",
        expiryDate: "TEMP",
      });
  
      event = await event.save({ validateBeforeSave: false });
      eventId = event._id.toString();
  
      uploadAWS(eventId).fields([
        { name: "image", maxCount: 1 },
        { name: "featuredEventImage", maxCount: 1 }
      ])(req, res, async (err) => {
        if (err) {
          await Event.findByIdAndDelete(eventId);
          return res.status(500).send("Image upload failed");
        }
  
        req.body = sanitizeBodyKeys(req.body);
  
        try {
          const updatedEvent = await updateEvent(eventId, req.body, req.files);
          if (!updatedEvent) {
            await Event.findByIdAndDelete(eventId);
            return res.status(500).send("Event update failed");
          }
  
          res.send(updatedEvent);
        } catch (updateErr) {
          console.error(updateErr);
          await Event.findByIdAndDelete(eventId);
          return res.status(500).send(updateErr.message || "Event update error");
        }
      });
  
    } catch (e) {
      console.error(e);
      if (eventId) {
        await Event.findByIdAndDelete(eventId);
      }
      return res.status(500).send("Failed to create event");
    }
});
  
router.post("/update", verifyTokenAndAdmin, async (req, res) => {
    try {
      await uploadAWS(req.body.eventId).fields([
        { name: "image", maxCount: 1 },
        { name: "featuredEventImage", maxCount: 1 }
      ])(req, res, async (err) => {
        if (err) {
          return res.status(500).send("The event cannot be updated");
        }
  
        const event = await updateEvent(req.body.eventId, req.body, req.files);
        if (!event) {
          return res.status(500).send("The event cannot be updated");
        }
  
        res.send(event);
      });
    } catch (e) {
      return res.status(500).send("The event cannot be updated");
    }
});
  
router.get("/active", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
  
    const { day, month, year } = req.query;
  
    try {
      const baseFilter = { isActive: true, isDeleted: false };
  
      // Optional date filtering
      if (year || month || day) {
        let regexPattern = "^";
  
        if (year) {
          regexPattern += `${year}`;
        } else {
          regexPattern += "\\d{4}";
        }
  
        if (month) {
          regexPattern += `-${month.padStart(2, "0")}`;
        } else {
          regexPattern += "-\\d{2}";
        }
  
        if (day) {
          regexPattern += `-${day.padStart(2, "0")}`;
        }
  
        baseFilter.eventDate = { $regex: regexPattern };
      }
  
      const events = await Event.find(baseFilter)
        .skip(skip)
        .limit(limit)
        .sort({ uploadedDate: -1 });
  
      const totalEvents = await Event.countDocuments(baseFilter);
  
      if (!events || events.length === 0) {
        return res.status(404).json({ message: "No events found for the specified criteria." });
      }
  
      res.status(200).json({
        events,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalEvents / limit),
          totalItems: totalEvents,
        },
      });
    } catch (err) {
      console.error("Error fetching active events:", err);
      res.status(500).json({ message: "Server Error" });
    }
});  

router.get("/featured", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
  
    try {
      const events = await Event.find({ isFeatured: true, isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const totalEvents = await Event.countDocuments({ isFeatured: true, isDeleted: false });
  
      res.status(200).json({
        events,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalEvents / limit),
          totalItems: totalEvents,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.get("/filter", async (req, res) => {
    try {
      const { day, month, year } = req.query;
  
      if (!year && !month && !day) {
        return res.status(400).json({ message: "Please provide at least one of year, month, or day" });
      }
  
      let regexPattern = "^";
  
      if (year) {
        regexPattern += `${year}`;
      } else {
        regexPattern += "\\d{4}";
      }
  
      if (month) {
        regexPattern += `-${month.padStart(2, "0")}`;
      } else {
        regexPattern += "-\\d{2}";
      }
  
      if (day) {
        regexPattern += `-${day.padStart(2, "0")}`;
      }
  
      const events = await Event.find({
        eventDate: { $regex: regexPattern },
        isDeleted: false,
      });
  
      if (!events || events.length === 0) {
        return res.status(404).json({ message: "No events found for the specified date." });
      }
  
      res.status(200).json(events);
    } catch (err) {
      console.error("Error filtering events:", err);
      res.status(500).json({ message: "Server Error" });
    }
});

router.get("/recent/:limit", async (req, res) => {
    const limit = parseInt(req.params.limit) || 5;
  
    try {
      const recentEvents = await Event.find({
        isActive: true,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .limit(limit);
  
      res.status(200).json(recentEvents);
    } catch (err) {
      console.error("Error fetching recent events:", err);
      res.status(500).json({ message: "Server Error" });
    }
});
 
router.get("/all", verifyTokenAndAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
  
      const events = await Event.find({ isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const totalEvents = await Event.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        events,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalEvents / limit),
          totalItems: totalEvents,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.get("/:id", async (req, res) => {
    const eventId = req.params.id;
  
    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(400).send("Invalid Event ID");
    }
  
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).send("Event not found");
      }
      res.status(200).send(event);
    } catch (error) {
      res.status(500).send("Error retrieving the event");
    }
});

router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const event = await Event.findByIdAndUpdate(
        id,
        { isDeleted: true }, 
        { new: true }    
      );
  
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
  
      res.status(200).json("Event marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});
  
async function updateEvent(eventId, data, fileList) {
    if (!data.name || !data.description) throw new Error("Name and description are required");

    let name = data.name;
    let description = data.description;

    try {
    if (typeof name === "string") name = JSON.parse(name);
    if (typeof description === "string") description = JSON.parse(description);
    } catch (e) {
    throw new Error("Invalid JSON in name or description");
    }

    if (!data.eventDate) throw new Error("Event date is required");
    if (!data.expiryDate) throw new Error("Expiry date is required");

    const image = fileList?.image?.[0] ? fileList.image[0].location : (data.image && data.image.trim() !== '' ? data.image : existingEvent.image);

    const featuredEventImage = fileList?.featuredEventImage?.[0]? fileList.featuredEventImage[0].location : (data.featuredEventImage && data.featuredEventImage.trim() !== '' ? data.featuredEventImage : existingEvent.featuredEventImage);

  
    const updateData = {
      name,
      description,
      eventDate: data.eventDate,
      expiryDate: data.expiryDate,
      eventLink: data.eventLink || '',
      registeredPeopleCount: data.registeredPeopleCount || '0',
      isFeatured: data.isFeatured || false,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isDeleted: false,
      image,
      featuredEventImage,
    };
  
    const updatedEvent = await Event.findByIdAndUpdate(eventId, updateData, { new: true });
    return updatedEvent;
}
  
function sanitizeBodyKeys(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.trim(), v])
    );
}
  
module.exports = router;