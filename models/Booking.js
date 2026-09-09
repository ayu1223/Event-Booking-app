const mongoose = require("mongoose");

const BOOKING_STATUSES = ["confirmed", "cancelled", "attended"];

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      // human-friendly ID, e.g. EVT-2026-A7F92K
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    attendeeName: {
      type: String,
      required: [true, "Attendee name is required"],
      trim: true,
    },
    attendeeEmail: {
      type: String,
      required: [true, "Attendee email is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    bookingDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "confirmed",
      index: true,
    },
    remindersSent: {
      // tracks which reminders have already gone out to avoid duplicates
      type: [String], // e.g. ["24h", "1h"]
      default: [],
    },
    rescheduledFrom: {
      // if this booking is the result of a reschedule, points to the original booking
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate active bookings for the same email on the same event
bookingSchema.index(
  { eventId: 1, attendeeEmail: 1, status: 1 },
  { unique: false }
);

module.exports = mongoose.model("Booking", bookingSchema);
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
