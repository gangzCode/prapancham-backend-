const express = require("express");
const router = express.Router();
const { Addons } = require("../models/addons");
const { verifyTokenAndAdmin } = require("./verifyToken");

router.post("/", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    const newAddons = new Addons({ name });

    const savedAddons = await newAddons.save();
    res.status(201).json(savedAddons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const updatedAddons = await Addons.findByIdAndUpdate(
      id,
      { name },
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

router.get("/", async (req, res) => {
  try {
    const addons = await Addons.find({ isDeleted: false });
    res.status(200).json(addons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const addons = await Addons.findByIdAndUpdate(
      id,
      { isDeleted: true }, 
      { new: true }    
    );

    if (!addons) {
      return res.status(404).json({ message: "Addons not found" });
    }

    res.status(200).json("Addons marked as deleted");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
