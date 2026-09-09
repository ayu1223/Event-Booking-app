const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const bookingController = require("../controllers/bookingController");
const {
  bookingValidationRules,
  handleValidationErrors,
} = require("../middleware/validation");

router.get("/events/:id/book", asyncHandler(bookingController.renderBookingForm));
router.post(
  "/events/:id/book",
  bookingValidationRules,
  handleValidationErrors,
  asyncHandler(bookingController.createBooking)
);

router.get(
  "/booking/confirmation/:bookingId",
  asyncHandler(bookingController.showConfirmation)
);
router.get(
  "/booking/:bookingId/calendar.ics",
  asyncHandler(bookingController.downloadCalendarFile)
);
router.get("/booking/verify/:bookingId", asyncHandler(bookingController.verifyBooking));

router.get("/my-bookings", bookingController.renderMyBookingsForm);
router.post("/my-bookings", asyncHandler(bookingController.lookupMyBookings));

router.post(
  "/bookings/:bookingId/cancel",
  asyncHandler(bookingController.cancelBooking)
);

router.get(
  "/bookings/:bookingId/reschedule",
  asyncHandler(bookingController.renderRescheduleForm)
);
router.post(
  "/bookings/:bookingId/reschedule",
  asyncHandler(bookingController.rescheduleBooking)
);

module.exports = router;
