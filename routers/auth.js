const express = require("express");
const router = express.Router();
const { AdminUser } = require("../models/adminUser");
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const { verifyTokenAndSuperAdmin } = require("./verifyToken");
const mongoose = require("mongoose");

//REGISTER
router.post("/register", async (req, res) => {
  try {
    const {
      username,
      email,
      phone,
      password,
      isAdmin,
      isSuperAdmin,
      adminAccessPages
    } = req.body;

    const encryptedPassword = CryptoJS.AES.encrypt(password, process.env.PASS_SEC).toString();

    // Logic: SuperAdmin or Admin
    if (isAdmin && (!Array.isArray(adminAccessPages) || adminAccessPages.length === 0)) {
      return res.status(400).json({
        message: "adminAccessPages are required when isAdmin is true",
      });
    }

    if (!isAdmin && !isSuperAdmin && Array.isArray(adminAccessPages) && adminAccessPages.length > 0) {
      return res.status(400).json({
        message: "Non-admin users are not allowed to have adminAccessPages",
      });
    }

    const newUser = new AdminUser({
      username,
      email,
      phone,
      password: encryptedPassword,
      isAdmin: isSuperAdmin || isAdmin,
      isSuperAdmin,
      ...(isAdmin && { adminAccessPages }) // assign only if isAdmin is true
    });

    const savedUser = await newUser.save();
    return res.status(201).json(savedUser);
  } catch (err) {
    return res.status(500).json({ message: err.message });
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

router.put("/:id", verifyTokenAndSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      username,
      email,
      phone,
      isAdmin,
      isSuperAdmin,
      adminAccessPages
    } = req.body;

    const updateData = {
      ...(username && { username }),
      ...(email && { email }),
      ...(phone && { phone }),
      ...(typeof isAdmin !== "undefined" && { isAdmin }),
      ...(typeof isSuperAdmin !== "undefined" && { isSuperAdmin }),
    };

    if (isAdmin || isSuperAdmin) {
      if (adminAccessPages && Array.isArray(adminAccessPages)) {
        updateData.adminAccessPages = adminAccessPages;
      }
    } else if (adminAccessPages && adminAccessPages.length > 0) {
      return res.status(400).json({
        message: "Non-admin users cannot update adminAccessPages",
      });
    }

    const updatedUser = await AdminUser.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    return res.status(200).json(updatedUser);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/admin-user/all", verifyTokenAndSuperAdmin, async (req, res) => {
  const page = parseInt(req.query.page) || 1;     
  const limit = parseInt(req.query.limit) || 10;  
  const skip = (page - 1) * limit;

  try {
    const adminUsers = await AdminUser.find({ isDeleted: false })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await AdminUser.countDocuments({ isDeleted: false });

    res.status(200).json({
      adminUsers,
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

router.get("/admin-user/:id",verifyTokenAndSuperAdmin, async (req, res) => {
  const adminId = req.params.id;

  if (!mongoose.isValidObjectId(adminId)) {
    return res.status(400).send("Invalid admin id");
  }

  try {
    const admin = await AdminUser.findById(adminId);
    if (!admin) {
      return res.status(404).send("Admin not found");
    }
    res.status(200).send(admin);
  } catch (error) {
    res.status(500).send("Error retrieving the admin");
  }
});

router.delete("/admin-user/:id", verifyTokenAndSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await AdminUser.findByIdAndUpdate(
      id,
      { isDeleted: true }, 
      { new: true }    
    );

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json("Admin marked as deleted");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;