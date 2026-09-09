/**
 * Protects /admin/* routes. Requires an active session created by the
 * admin login flow (see controllers/adminController.js).
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }

  if (req.originalUrl.startsWith("/admin/api")) {
    return res.status(401).json({ error: "Authentication required." });
  }

  req.session.returnTo = req.originalUrl;
  return res.redirect("/admin/login");
}

/**
 * Redirects already-logged-in admins away from the login page.
 */
function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.adminId) {
    return res.redirect("/admin");
  }
  next();
}

/**
 * Protects routes that require a logged-in registered user (organizer),
 * as distinct from an admin. Uses its own session key (userId) so a person
 * can never accidentally get organizer access via the admin session or
 * vice versa.
 */
function requireUser(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  req.session.returnTo = req.originalUrl;
  return res.redirect("/login");
}

/**
 * Redirects already-logged-in users away from the login/register pages.
 */
function redirectIfUserAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect("/my-events");
  }
  next();
}

module.exports = {
  requireAdmin,
  redirectIfAuthenticated,
  requireUser,
  redirectIfUserAuthenticated,
};
