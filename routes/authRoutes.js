const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const userAuthController = require("../controllers/userAuthController");
const { redirectIfUserAuthenticated } = require("../middleware/auth");
const {
  registerValidationRules,
  userLoginValidationRules,
  handleValidationErrors,
} = require("../middleware/validation");

// Brute-force protection on register/login specifically.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many attempts. Please try again in 15 minutes.",
});

router.get("/register", redirectIfUserAuthenticated, userAuthController.renderRegister);
router.post(
  "/register",
  authLimiter,
  registerValidationRules,
  handleValidationErrors,
  asyncHandler(userAuthController.register)
);

router.get("/login", redirectIfUserAuthenticated, userAuthController.renderLogin);
router.post(
  "/login",
  authLimiter,
  userLoginValidationRules,
  handleValidationErrors,
  asyncHandler(userAuthController.login)
);

router.post("/logout", userAuthController.logout);

module.exports = router;
