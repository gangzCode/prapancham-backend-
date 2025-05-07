const express = require("express");
const router = express.Router();
const { AdminUser } = require("../models/adminUser");
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const { verifyTokenAndSuperAdmin } = require("./verifyToken");

//REGISTER
router.post("/register", async (req, res) => {
  const newUser = new AdminUser({
    username: req.body.username,
    email: req.body.email,
    phone: req.body.phone,
    password: CryptoJS.AES.encrypt(req.body.password, process.env.PASS_SEC).toString(),
    isAdmin: req.body.isSuperAdmin || req.body.isAdmin,
    isSuperAdmin: req.body.isSuperAdmin,
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
    const user = await AdminUser.findOne({ username: req.body.username });
    if (!user) {
      return res.status(401).json("Wrong credentials!");
    }

    const hashedPassword = CryptoJS.AES.decrypt(user.password, process.env.PASS_SEC);
    const OriginalPassword = hashedPassword.toString(CryptoJS.enc.Utf8);

    if (OriginalPassword !== req.body.password) {
      return res.status(401).json("Wrong credentials!");
    }

    const accessToken = jwt.sign(
      {
        id: user._id,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
      },
      process.env.JWT_SEC,
      { expiresIn: "1d" }
    );

    const { password, ...others } = user._doc;

    res.status(200).json({ ...others, accessToken });
  } catch (err) {
    return res.status(500).json(err);
  }
});

module.exports = router;