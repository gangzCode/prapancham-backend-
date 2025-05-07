const express = require("express");
const router = express.Router();
const { Faq } = require("../models/faq");
const { verifyTokenAndAdmin } = require("./verifyToken");

router.post("/", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { question, answer, listingNumber, status } = req.body;

    const newFaq = new Faq({ question, answer, listingNumber, status});

    const savedFaq = await newFaq.save();
    res.status(201).json(savedFaq);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, listingNumber, status } = req.body;

    const updatedFaq = await Faq.findByIdAndUpdate(
      id,
      { question, answer, listingNumber, status },
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

router.get("/all-faq", verifyTokenAndAdmin, async (req, res) => {
  try {
    const faqs = await Faq.find({ isDeleted: false });
    res.status(200).json(faqs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/active-faq", async (req, res) => {
  try {
    const faqs = await Faq.find({ isActive: true });
    res.status(200).json(faqs);
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
