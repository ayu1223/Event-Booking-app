const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const organizerController = require("../controllers/organizerController");
const { requireUser } = require("../middleware/auth");
const {
  organizerEventValidationRules,
  handleValidationErrors,
} = require("../middleware/validation");

router.use(requireUser);

router.get("/", asyncHandler(organizerController.renderMyEvents));
router.get("/new", organizerController.renderNewEventForm);
router.post(
  "/new",
  organizerEventValidationRules,
  handleValidationErrors,
  asyncHandler(organizerController.createEvent)
);
router.get("/:id/edit", asyncHandler(organizerController.renderEditEventForm));
router.post(
  "/:id/edit",
  organizerEventValidationRules,
  handleValidationErrors,
  asyncHandler(organizerController.updateEvent)
);
router.post("/:id/cancel", asyncHandler(organizerController.cancelEvent));
router.post("/:id/delete", asyncHandler(organizerController.deleteEvent));

module.exports = router;
