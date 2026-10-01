const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

adminSchema.methods.verifyPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

adminSchema.statics.hashPassword = function (plainPassword) {
  return bcrypt.hash(plainPassword, 12);
};


adminSchema.statics.ensureSeedAdmin = async function () {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "ADMIN_EMAIL / ADMIN_PASSWORD not set - skipping admin seed. Admin login will not work until these are configured."
    );
    return;
  }

  const existing = await this.findOne({ email: email.toLowerCase() });
  if (existing) return;

  const passwordHash = await this.hashPassword(password);
  await this.create({ email: email.toLowerCase(), passwordHash });
  console.log(`Admin account ready for ${email}`);
};

module.exports = mongoose.model("Admin", adminSchema);
