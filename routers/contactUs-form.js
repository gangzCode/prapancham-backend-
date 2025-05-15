const express = require("express");
const router = express.Router();
const { ContactUsForm } = require("../models/contactUs-form");
const { verifyTokenAndAdmin } = require("./verifyToken");

router.post("/", async (req, res) => {
  try {
    const { firstName,lastName,email,phoneNumber,country,description } = req.body;

    const newContactUsFormData = new ContactUsForm({ firstName, lastName,email,phoneNumber,country,description });

    const savedContactUsFormData= await newContactUsFormData.save();
    res.status(201).json(savedContactUsFormData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", verifyTokenAndAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const contactUsForm = await ContactUsForm.find({ isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalContactUsForm = await ContactUsForm.countDocuments({ isDeleted: false });

    res.status(200).json({
      contactUsForm,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalContactUsForm / limit),
        totalItems: totalContactUsForm,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", verifyTokenAndAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const contactUsFormData = await ContactUsForm.findByIdAndUpdate(
      id,
      { isDeleted: true }, 
      { new: true }    
    );

    if (!contactUsFormData) {
      return res.status(404).json({ message: "Contact us form data not found" });
    }

    res.status(200).json("Contact us form data marked as deleted");
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
