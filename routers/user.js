const express = require("express");
const router = express.Router();
const { User } = require("../models/user");
const { ForgetPasswordCode } = require("../models/forgetPasswordCode");
const CryptoJS = require("crypto-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { verifyTokenAndSuperAdmin } = require("./verifyToken");
const mongoose = require("mongoose");
const { verifyToken, verifyTokenAndAuthorization, verifyTokenAndAdmin } = require("./verifyToken");
const { generate6DigitCode, sendVerificationEmail } = require("../report/nodemailer");
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

const uploadAWS = (userId) =>
  multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.SPACE_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueFilename = `${userId}/${uuid.v4()}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
});

const uploadOptions = multer({ storage: storage });

//REGISTER
router.post("/register", async (req, res) => {
  const newUser = new User({
    username: req.body.username,
    email: req.body.email,
    password: CryptoJS.AES.encrypt(req.body.password, process.env.PASS_SEC).toString(),
  });

  try {
    const savedUser = await newUser.save();
    return res.status(201).json(savedUser);
  } catch (err) {
    return res.status(500).json(err);
  }
});

//LOGIN
router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (!user || user.isDeleted || !user.isActive) {
      return res.status(401).json("Invalid username or password.");
    }

    const hashedPassword = CryptoJS.AES.decrypt(user.password, process.env.PASS_SEC);
    const originalPassword = hashedPassword.toString(CryptoJS.enc.Utf8);

    if (originalPassword !== req.body.password) {
      return res.status(401).json("Invalid username or password.");
    }

    const accessToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SEC,
      { expiresIn: "1d" }
    );

    const { password, ...others } = user._doc;
    res.status(200).json({ ...others, accessToken });
  } catch (err) {
    return res.status(500).json("Something went wrong. Try again.");
  }
});

//UPDATE
router.post(`/update/:userId`, verifyTokenAndAuthorization, async (req, res) => {
  try {
    await uploadAWS(req.params.userId).fields([
      { name: "image", maxCount: 1 },
    ])(req, res, async (err) => {
      if (err) {
        return res.status(500).send("The user cannot be updated");
      }

      req.body = sanitizeBodyKeys(req.body);
      
      let user = await updateUser(req.params.userId, req.body, req.files);
      if (!user) {
        return res.status(500).send("The user cannot be updated");
      }
      res.send(user);
    });
  } catch (e) {
    return res.status(500).send("The user cannot be updated");
  }
});

router.get("/all", verifyTokenAndAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const user = await User.find({ isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments({ isDeleted: false });

    res.status(200).json({
      user,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalItems: totalUsers,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/active",verifyTokenAndAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const user = await User.find({ isActive: true,isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments({ isActive: true,isDeleted: false });

    res.status(200).json({
      user,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalItems: totalUsers,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id",verifyTokenAndAdmin, async (req, res) => {
  const userId = req.params.id;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).send("Invalid Faq ID");
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found");
    }
    res.status(200).send(user);
  } catch (error) {
    res.status(500).send("Error retrieving the user");
  }
});

router.post("/forgot-password/send-code", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.status(404).json({ message: "User not found" });

  const code = generate6DigitCode();

  // Delete old code if exists
  await ForgetPasswordCode.deleteMany({ email });

  const newCode = new ForgetPasswordCode({ email, code });
  await newCode.save();

  await sendVerificationEmail(email, code);

  return res.status(200).json({ message: "Verification code sent" });
});

router.post("/forgot-password/resend-code", async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const code = generate6DigitCode();

  await ForgetPasswordCode.deleteMany({ email });

  const newCode = new ForgetPasswordCode({ email, code });
  await newCode.save();

  await sendVerificationEmail(email, code);

  return res.status(200).json({ message: "Verification code resent" });
});

router.post("/forgot-password/verify-code", async (req, res) => {
  const { email, code } = req.body;

  const record = await ForgetPasswordCode.findOne({ email, code });
  if (!record) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }

  record.verified = true;
  await record.save();
  return res.status(200).json({ message: "Code verified successfully" });
});

router.post("/forgot-password/reset", async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  if (!newPassword || !confirmPassword) {
    return res.status(400).json({ message: "Passwords are missing" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  const record = await ForgetPasswordCode.findOne({ email, verified: true });
  if (!record) {
    return res.status(403).json({ message: "Verification required" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const user = await User.findOneAndUpdate(
    { email },
    { password: hashedPassword },
    { new: true }
  );

  // Delete the verification code after use
  await ForgetPasswordCode.deleteMany({ email });

  return res.status(200).json({ message: "Password reset successful" });
});


//FUNCTIONS
async function updateUser(userId,body,fileList) { 
  const updateData = {
    isDeleted: false,
    isActive: true,
    username:body.username,
    phone: body.phone,
    country: body.country,
    address: body.address,
    ...(fileList?.image?.[0] && { image: fileList.image[0].location }),
  };

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

  return updatedUser;
}

function sanitizeBodyKeys(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.trim(), v])
  );
}

module.exports = router;