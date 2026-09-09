const { body, validationResult } = require("express-validator");
const { AppError } = require("./errorHandler");

// Collects express-validator errors and turns the first one into an AppError,
// so every route gets consistent, server-enforced validation.
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 400));
  }
  next();
}

const bookingValidationRules = [
  body("attendeeName")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("attendeeEmail")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
];

// Shared by both the admin event form and the organizer (self-serve) event
// form. The admin form additionally collects an explicit "organizer" text
// field; the organizer form fills it in server-side from the logged-in
// user's name, so that check is added separately (see eventValidationRules
// vs organizerEventValidationRules below).
const baseEventValidationRules = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Event title is required")
    .isLength({ max: 150 })
    .withMessage("Title must be under 150 characters"),
  body("date")
    .notEmpty()
    .withMessage("Event date is required")
    .isISO8601()
    .withMessage("Please provide a valid date"),
  body("startTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("Start time must be in HH:mm format"),
  body("endTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("End time must be in HH:mm format"),
  body("mode")
    .isIn(["online", "offline"])
    .withMessage("Mode must be online or offline"),
  body("capacity")
    .isInt({ min: 1 })
    .withMessage("Capacity must be a positive number"),
  body("location").custom((value, { req }) => {
    if (req.body.mode === "offline" && (!value || !value.trim())) {
      throw new Error("Location is required for offline events");
    }
    return true;
  }),
];

const eventValidationRules = [
  ...baseEventValidationRules,
  body("organizer").trim().notEmpty().withMessage("Organizer is required"),
];

const organizerEventValidationRules = baseEventValidationRules;

const adminLoginValidationRules = [
  body("email").trim().isEmail().withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

const registerValidationRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

const userLoginValidationRules = [
  body("email").trim().isEmail().withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

module.exports = {
  handleValidationErrors,
  bookingValidationRules,
  eventValidationRules,
  organizerEventValidationRules,
  adminLoginValidationRules,
  registerValidationRules,
  userLoginValidationRules,
};
