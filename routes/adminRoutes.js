const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const adminController = require("../controllers/adminController");
const eventController = require("../controllers/eventController");
const { requireAdmin, redirectIfAuthenticated } = require("../middleware/auth");
const {
  eventValidationRules,
  adminLoginValidationRules,
  handleValidationErrors,
} = require("../middleware/validation");

// Brute-force protection on the login endpoint specifically.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

router.get("/login", redirectIfAuthenticated, adminController.renderLogin);
router.post(
  "/login",
  loginLimiter,
  adminLoginValidationRules,
  handleValidationErrors,
  asyncHandler(adminController.login)
);
router.post("/logout", adminController.logout);

router.use(requireAdmin);

router.get("/", asyncHandler(eventController.renderAdminDashboard));

router.get("/events", asyncHandler(eventController.renderEventList));
router.get("/events/new", eventController.renderNewEventForm);
router.post(
  "/events",
  eventValidationRules,
  handleValidationErrors,
  asyncHandler(eventController.createEvent)
);
router.get("/events/:id/edit", asyncHandler(eventController.renderEditEventForm));
router.post(
  "/events/:id/edit",
  eventValidationRules,
  handleValidationErrors,
  asyncHandler(eventController.updateEvent)
);
router.post("/events/:id/cancel", asyncHandler(eventController.cancelEvent));
router.post("/events/:id/delete", asyncHandler(eventController.deleteEvent));

router.get("/bookings", asyncHandler(adminController.listBookings));
router.get("/bookings/export", asyncHandler(adminController.exportBookingsCSV));

module.exports = router;
