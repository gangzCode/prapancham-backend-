const { Country } = require("../models/country");
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { verifyToken, verifyTokenAndAuthorization, verifyTokenAndAdmin } = require("./verifyToken");
const multer = require("multer");
const multerS3 = require("multer-s3-v3");
const fs = require("fs");
//const aws = require("aws-sdk");
const uuid = require("uuid");
const { S3Client } = require("@aws-sdk/client-s3");

const dotenv = require("dotenv");

dotenv.config();

/*aws.config.update({
  secretAccessKey: process.env.SPACE_ACCESSKEYSECRET,
  accessKeyId: process.env.SPACE_ACCESSKEYID,
  region: process.env.SPACE_REGION,
});*/

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

const uploadAWS = (countryId) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${countryId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
});

const uploadOptions = multer({ storage: storage });

router.post("/", verifyTokenAndAdmin, async (req, res) => {
    let countryId;
  
    try {
      let country = new Country({
        name: { en: [], ta: [], si: [] },
        currencyCode:"TEMP",
      });
  
      country = await country.save({ validateBeforeSave: false });
      countryId = country._id.toString();
  
      uploadAWS(countryId).fields([
        { name: "image", maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) {
          await Country.findByIdAndDelete(countryId);
          return res.status(500).send("Image upload failed");
        }
  
        req.body = sanitizeBodyKeys(req.body);

        if (typeof req.body.name === 'string') {
            try {
              req.body.name = JSON.parse(req.body.name);
            } catch (parseError) {
              await Country.findByIdAndDelete(countryId);
              return res.status(400).send("Invalid JSON in 'name' field");
            }
          }
  
        try {
          const updatedCountry = await updateCountry(countryId, req.body, req.files);
          if (!updatedCountry) {
            await Country.findByIdAndDelete(countryId);
            return res.status(500).send("Country update failed");
          }
  
          res.send(updatedCountry);
        } catch (updateErr) {
          console.error(updateErr);
          await Country.findByIdAndDelete(countryId);
          return res.status(500).send(updateErr.message || "Country update error");
        }
      });
  
    } catch (e) {
      console.error(e);
      if (countryId) {
        await Country.findByIdAndDelete(countryId);
      }
      return res.status(500).send("Failed to create country");
    }
});
  
router.post("/update", verifyTokenAndAdmin, async (req, res) => {
    try {
      await uploadAWS(req.body.countryId).fields([
        { name: "image", maxCount: 1 },
      ])(req, res, async (err) => {
        if (err) {
          return res.status(500).send("The country cannot be updated");
        }

        req.body = sanitizeBodyKeys(req.body);


        if (typeof req.body.name === 'string') {
            try {
              req.body.name = JSON.parse(req.body.name);
            } catch (parseError) {
              return res.status(400).send("Invalid JSON in 'name' field");
            }
        }
  
        const country = await updateCountry(req.body.countryId, req.body, req.files);
        if (!country) {
          return res.status(500).send("The country cannot be updated");
        }
  
        res.send(country);
      });
    } catch (e) {
      return res.status(500).send("The country cannot be updated");
    }
});
  
router.get("/active", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
  
    try {
      const countries = await Country.find({ isActive: true, isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const totalCountries = await Country.countDocuments({ isActive: true, isDeleted: false });
  
      res.status(200).json({
        countries,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCountries / limit),
          totalItems: totalCountries,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.get("/all", verifyTokenAndAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
  
      const countries = await Country.find({ isDeleted: false })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      const totalCountries = await Country.countDocuments({ isDeleted: false });
  
      res.status(200).json({
        countries,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCountries / limit),
          totalItems: totalCountries,
        },
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});

router.get("/:id", async (req, res) => {
    const countryId = req.params.id;
  
    if (!mongoose.isValidObjectId(countryId)) {
      return res.status(400).send("Invalid Country ID");
    }
  
    try {
      const country = await Country.findById(countryId);
      if (!country) {
        return res.status(404).send("Country not found");
      }
      res.status(200).send(country);
    } catch (error) {
      res.status(500).send("Error retrieving the country");
    }
});

router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const country = await Country.findByIdAndUpdate(
        id,
        { isDeleted: true }, 
        { new: true }    
      );
  
      if (!country) {
        return res.status(404).json({ message: "Country not found" });
      }
  
      res.status(200).json("Country marked as deleted");
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
});
  
async function updateCountry(countryId, data, fileList) {
    if (!data.name || !data.currencyCode) throw new Error("Name and  currency code is required");

    let name = data.name;
    let currencyCode = data.currencyCode;
  
    const updateData = {
      name,
      currencyCode,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isDeleted: false,
      ...(fileList?.image?.[0] && { image: fileList.image[0].location }),
    };
  
    const updatedCountry = await Country.findByIdAndUpdate(countryId, updateData, { new: true });
    return updatedCountry;
}
  
function sanitizeBodyKeys(obj) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.trim(), v])
    );
}
  
module.exports = router;