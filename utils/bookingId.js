const crypto = require("crypto");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

function randomCode(length = 6) {
  let code = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * Generates a human-friendly booking ID like EVT-2026-A7F92K.
 * Uniqueness against the database is verified by the caller (retry on collision).
 */
function generateBookingId() {
  const year = new Date().getFullYear();
  return `EVT-${year}-${randomCode(6)}`;
}

module.exports = { generateBookingId };
