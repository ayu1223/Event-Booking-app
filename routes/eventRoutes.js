const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const eventController = require("../controllers/eventController");

router.get("/", asyncHandler(eventController.renderHome));
router.get("/events", asyncHandler(eventController.listEvents));
router.get("/events/:id", asyncHandler(eventController.showEventDetails));

module.exports = router;
