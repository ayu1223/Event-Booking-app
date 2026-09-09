const User = require("../models/User");

function renderRegister(req, res) {
  res.render("auth/register", { errorMessage: null, name: "", email: "" });
}

async function register(req, res) {
  const { name, email, password } = req.body;
  const normalizedEmail = String(email).toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).render("auth/register", {
      errorMessage: "An account with that email already exists.",
      name,
      email,
    });
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email: normalizedEmail, passwordHash });

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).render("auth/register", {
        errorMessage: "Something went wrong. Please try again.",
        name,
        email,
      });
    }
    req.session.userId = user._id.toString();
    req.session.userName = user.name;
    const returnTo = req.session.returnTo || "/my-events";
    delete req.session.returnTo;
    res.redirect(returnTo);
  });
}

function renderLogin(req, res) {
  res.render("auth/login", { errorMessage: null });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() });

  const invalidCreds = () =>
    res.status(401).render("auth/login", { errorMessage: "Invalid email or password." });

  if (!user) return invalidCreds();

  const valid = await user.verifyPassword(password);
  if (!valid) return invalidCreds();

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).render("auth/login", {
        errorMessage: "Something went wrong. Please try again.",
      });
    }
    req.session.userId = user._id.toString();
    req.session.userName = user.name;
    const returnTo = req.session.returnTo || "/my-events";
    delete req.session.returnTo;
    res.redirect(returnTo);
  });
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect("/");
  });
}

module.exports = { renderRegister, register, renderLogin, login, logout };
