const express = require("express");
const router = express.Router();
const { Package } = require("../models/obituaryRemembarance-packages");
const { verifyTokenAndAdmin } = require("./verifyToken");
const { Addons } = require("../models/addons");

router.post('/obituary-packages', async (req, res) => {
    try {
        const {
            name,
            addons,
            isObituary,
            isRemembarace,
            isPremium,
            duration,
            description,
            wordLimit,
            priceList
        } = req.body;

        const uniqueAddons = [...new Set(addons)];
        if (uniqueAddons.length !== addons.length) {
            return res.status(400).json({ success: false, message: "Duplicate addons are not allowed." });
        }

        const existingAddons = await Addons.find({ _id: { $in: uniqueAddons }, isDeleted: false });
        if (existingAddons.length !== uniqueAddons.length) {
            return res.status(400).json({ success: false, message: "One or more addons are invalid or deleted." });
        }

        const newPackage = new ObituaryRemembarancePackages({
            name,
            addons,
            isObituary,
            isRemembarace,
            isPremium,
            price,
            duration,
            description,
            wordLimit,
            priceList
        });

        const savedPackage = await newPackage.save();
        res.status(201).json({ success: true, data: savedPackage });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


router.put("/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
        name,
        addons,
        isObituary,
        isRemembarace,
        isPremium,
        price,
        duration,
        description,
        wordLimit,
        priceList
    } = req.body;

    
    const uniqueAddons = [...new Set(addons)];
        if (uniqueAddons.length !== addons.length) {
            return res.status(400).json({ success: false, message: "Duplicate addons are not allowed." });
        }

    const existingAddons = await Addons.find({ _id: { $in: uniqueAddons }, isDeleted: false });
    if (existingAddons.length !== uniqueAddons.length) {
        return res.status(400).json({ success: false, message: "One or more addons are invalid or deleted." });
    }

    const updatedPackage = await Package.findByIdAndUpdate(
      id,
      { name,
        addons,
        isObituary,
        isRemembarace,
        isPremium,
        price,
        duration,
        description,
        wordLimit,
        priceList
    },
      { new: true, runValidators: true }
    );

    if (!updatedPackage) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.status(200).json(updatedPackage);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const packages = await Faq.find({ isDeleted: false });
    res.status(200).json(packages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const package = await Package.findByIdAndUpdate(
      id,
      { isDeleted: true }, 
      { new: true }    
    );

    if (!package) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.status(200).json("Package marked as deleted");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
