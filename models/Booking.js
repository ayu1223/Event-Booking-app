const mongoose = require("mongoose");

const BOOKING_STATUSES = ["confirmed", "cancelled", "attended"];

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
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
      type: [String], 
      default: [],
    },
    rescheduledFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
  },
  { timestamps: true }
);

bookingSchema.index(
  { eventId: 1, attendeeEmail: 1, status: 1 },
  { unique: false }
);

module.exports = mongoose.model("Booking", bookingSchema);
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
