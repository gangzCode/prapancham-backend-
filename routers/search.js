const express = require('express');
const {Order} = require("../models/order");
const {Event} = require("../models/event");
const {News} = require("../models/news");
const router = express.Router();

router.get("/", async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length === 0) {
    return res.status(400).json({ message: "Search query 'q' is required" });
  }

  const searchRegex = new RegExp(q, "i");

  try {
    const orders = await Order.find({
      isDeleted: false,
      $or: [
        { "information.firstName": searchRegex },
        { "information.lastName": searchRegex },
        { "information.preferredName": searchRegex },
        { "information.shortDescription": searchRegex },
        { "information.description": searchRegex },
        { "contactDetails.name": searchRegex },
        { "contactDetails.country": searchRegex },
        { "contactDetails.address": searchRegex },
        { "contactDetails.relationship": searchRegex },
      ]
    });

    const news = await News.find({
      isDeleted: false,
      $or: [
        { "title.en.value": searchRegex },
        { "title.ta.value": searchRegex },
        { "title.si.value": searchRegex },
        { "description.en.value": searchRegex },
        { "description.ta.value": searchRegex },
        { "description.si.value": searchRegex },
        { "editorName.en.value": searchRegex },
        { "editorName.ta.value": searchRegex },
        { "editorName.si.value": searchRegex },
      ]
    });

    const events = await Event.find({
      isDeleted: false,
      $or: [
        { "name.en.value": searchRegex },
        { "name.ta.value": searchRegex },
        { "name.si.value": searchRegex },
        { "description.en.value": searchRegex },
        { "description.ta.value": searchRegex },
        { "description.si.value": searchRegex },
      ]
    });

    res.json({
      query: q,
      orders,
      news,
      events,
    });
  } catch (error) {
    console.error("Search error:", error.message);
    res.status(500).json({ message: "Server error during search" });
  }
});


module.exports = router;
