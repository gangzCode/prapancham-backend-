const express = require("express");
const router = express.Router();
const CryptoJS = require("crypto-js");
// module.exports =router;
const { User } = require("../models/user");

const { verifyToken, verifyTokenAndAuthorization, verifyTokenAndAdmin } = require("./verifyToken");

//UPDATE
router.put("/:id", verifyTokenAndAuthorization, async (req, res) => {
  if (req.body.password) {
    req.body.password = CryptoJS.AES.encrypt(req.body.password, process.env.PASS_SEC).toString();
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: req.body,
      },
      { new: true }
    );
    return res.status(200).json(updatedUser);
  } catch (err) {
    return res.status(500).json(err);
  }
});

//DELETE
router.delete("/:id", verifyTokenAndAuthorization, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },  // Update isDeleted status to true
      { new: true }  // Return the updated document
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json("User has been marked as deleted.");
  } catch (err) {
    return res.status(500).json(err);
  }
});

//GET USER
router.get("/find/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const { password, ...others } = user._doc;
    return res.status(200).json(others);
  } catch (err) {
    return res.status(500).json(err);
  }
});

//GET ALL USER
router.get("/", verifyTokenAndAdmin, async (req, res) => {
  const query = req.query.new;
  try {
    // Fetch users where isDeleted is false, and exclude the password field
    const users = query
      ? await User.find({ isDeleted: false }).sort({ _id: -1 }).limit(1).select({ password: 0 })
      : await User.find({ isDeleted: false }).select({ password: 0 });
    
    return res.status(200).json(users);
  } catch (err) {
    return res.status(500).json(err);
  }
});

//GET USER STATS
router.get("/stats", verifyTokenAndAdmin, async (req, res) => {
  const date = new Date();
  const lastYear = new Date(date.setFullYear(date.getFullYear() - 1));

  try {
    const data = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: lastYear },
          isDeleted: false, 
        },
      },
      {
        $project: {
          month: { $month: "$createdAt" }, 
        },
      },
      {
        $group: {
          _id: "$month", 
          total: { $sum: 1 }, 
        },
      },
    ]);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json(err);
  }
});


module.exports = router;
