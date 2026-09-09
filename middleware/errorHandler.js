class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function notFoundHandler(req, res) {
  res.status(404);
  if (req.originalUrl.startsWith("/admin/api")) {
    return res.json({ error: "Not found" });
  }
  res.render("errors/404", { url: req.originalUrl });
}

// Express recognizes error-handling middleware by its 4-argument signature.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === "production";
  const statusCode = err.statusCode || 500;

  if (!err.isOperational) {
    console.error("Unexpected error:", err);
  } else if (statusCode >= 500) {
    console.error("Server error:", err.message);
  }

  if (req.originalUrl.startsWith("/admin/api") || req.xhr) {
    return res.status(statusCode).json({
      error: err.isOperational
        ? err.message
        : "Something went wrong. Please try again later.",
    });
  }

  res.status(statusCode);

  if (statusCode === 400 || statusCode === 409) {
    return res.render("errors/validation", {
      message: err.isOperational ? err.message : "Invalid request.",
    });
  }

  res.render("errors/500", {
    message: err.isOperational
      ? err.message
      : "Something went wrong on our end. Please try again later.",
    stack: !isProduction && !err.isOperational ? err.stack : null,
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };
