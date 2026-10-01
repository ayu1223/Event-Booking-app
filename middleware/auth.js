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

function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.adminId) {
    return res.redirect("/admin");
  }
  next();
}

function requireUser(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  req.session.returnTo = req.originalUrl;
  return res.redirect("/login");
}


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
