const express = require("express");
const router = express.Router();
const { Faq } = require("../models/faq");
const { verifyTokenAndAdmin } = require("./verifyToken");
const mongoose = require("mongoose");

router.post("/", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { question, answer, listingNumber, isActive } = req.body;

    const newFaq = new Faq({ question, answer, listingNumber, isActive});

    const savedFaq = await newFaq.save();
    res.status(201).json(savedFaq);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, listingNumber, isActive } = req.body;

    const updatedFaq = await Faq.findByIdAndUpdate(
      id,
      { question, answer, listingNumber, isActive },
      { new: true, runValidators: true }
    );

    if (!updatedFaq) {
      return res.status(404).json({ message: "Faq not found" });
    }

    res.status(200).json(updatedFaq);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/all", verifyTokenAndAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const faqs = await Faq.find({ isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalFaqs = await Faq.countDocuments({ isDeleted: false });

    res.status(200).json({
      faqs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalFaqs / limit),
        totalItems: totalFaqs,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id",verifyTokenAndAdmin, async (req, res) => {
  const faqId = req.params.id;

  if (!mongoose.isValidObjectId(faqId)) {
    return res.status(400).send("Invalid Faq ID");
  }

  try {
    const faq = await Faq.findById(faqId);
    if (!faq) {
      return res.status(404).send("Faq not found");
    }
    res.status(200).send(faq);
  } catch (error) {
    res.status(500).send("Error retrieving the faq");
  }
});

router.get("/active", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const faqs = await Faq.find({ isActive: true,isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalFaqs = await Faq.countDocuments({ isActive: true,isDeleted: false });

    res.status(200).json({
      faqs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalFaqs / limit),
        totalItems: totalFaqs,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const faq = await Faq.findByIdAndUpdate(
      id,
      { isDeleted: true }, 
      { new: true }    
    );

    if (!faq) {
      return res.status(404).json({ message: "Faq not found" });
    }

    res.status(200).json("Faq marked as deleted");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
