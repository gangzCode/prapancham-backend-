const { NewsLetter } = require("../models/news-letter");
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const validator = require("email-validator");
// const {sendContactUsEmail} = require("../report/mailgun");
const { sendContactUsEmail } = require("../report/nodemailer");
const { verifyTokenAndAdmin } = require("./verifyToken");

router.post(`/`, async (req, res) => {
  try {
    if (!validator.validate(req.body.email)) {
      return res.status(400).send({
        success: false,
        message: "Invalid email format. Please enter a valid email address.",
      });
    }

    const existingEmail = await NewsLetter.findOne({ email: req.body.email });
    if (existingEmail) {
      return res.status(200).send({
        success: false,
        message: "You are already subscribed to the newsletter.",
      });
    }

    const email = new NewsLetter({ email: req.body.email });
    await email.save();

    return res.status(201).send({
      success: true,
      message: "Successfully subscribed to the newsletter.",
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: "An error occurred while processing your request.",
      error: err.message,
    });
  }
});

router.post(`/inquire`, async (req, res) => {
  try {
    await sendContactUsEmail(req.body.name, req.body.email, req.body.phone, req.body.message);
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

router.get("/", verifyTokenAndAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const newsletter = await NewsLetter.find({ isDeleted: false })
      .skip(skip)
      .limit(limit);

    const totalNewsLetter = await NewsLetter.countDocuments({ isDeleted: false });

    res.status(200).json({
      newsletter,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalNewsLetter / limit),
        totalItems: totalNewsLetter,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", verifyTokenAndAdmin, (req, res) => {
  NewsLetter.findByIdAndDelete(req.params.id)
    .then((email) => {
      if (email) {
        return res.status(200).json({ success: true, message: "the subscriber is deleted!" });
      } else {
        return res.status(404).json({ success: false, message: "subscriber not found!" });
      }
    })
    .catch((err) => {
      return res.status(500).json({ success: false, error: err });
    });
});

module.exports = router;
