const QRCode = require("qrcode");

/**
 * Generates a QR code (as a data URL) that encodes the booking verification
 * URL, e.g. https://host/booking/verify/EVT-2026-A7F92K
 */
async function generateBookingQRCode(bookingId, baseUrl) {
  const verifyUrl = `${baseUrl}/booking/verify/${bookingId}`;
  return QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 240,
    color: { dark: "#111827", light: "#ffffff" },
  });
}

module.exports = { generateBookingQRCode };
