const mongoose = require("mongoose");

const EVENT_STATUSES = ["upcoming", "ongoing", "completed", "cancelled"];
const EVENT_MODES = ["online", "offline"];

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },
    organizer: {
      type: String,
      required: [true, "Organizer name is required"],
      trim: true,
    },
    createdBy: {
      // the registered user who created this event, if any. Events created
      // by an admin (via /admin/events) leave this null.
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    date: {
      // Calendar date the event occurs on (stored at midnight UTC of that day)
      type: Date,
      required: [true, "Event date is required"],
      index: true,
    },
    startTime: {
      // "HH:mm" 24-hour string, combined with `date` to compute actual start
      type: String,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },
    mode: {
      type: String,
      enum: EVENT_MODES,
      required: true,
    },
    location: {
      // required only for offline events
      type: String,
      trim: true,
      default: "",
    },
    meetingLink: {
      // generated for online events
      type: String,
      default: "",
    },
    capacity: {
      type: Number,
      required: [true, "Capacity is required"],
      min: [1, "Capacity must be at least 1"],
    },
    availableSeats: {
      type: Number,
      required: true,
      min: [0, "Available seats cannot be negative"],
    },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      default: "upcoming",
      index: true,
    },
  },
  { timestamps: true }
);

// Helpful compound index for listing/searching events by date + status
eventSchema.index({ date: 1, status: 1 });
eventSchema.index({ title: "text", description: "text" });

/**
 * Returns a real JS Date representing the event's start moment,
 * combining `date` (calendar day) with `startTime` ("HH:mm").
 */
eventSchema.methods.getStartDateTime = function () {
  const [hours, minutes] = this.startTime.split(":").map(Number);
  const start = new Date(this.date);
  start.setHours(hours, minutes, 0, 0);
  return start;
};

eventSchema.methods.getEndDateTime = function () {
  const [hours, minutes] = this.endTime.split(":").map(Number);
  const end = new Date(this.date);
  end.setHours(hours, minutes, 0, 0);
  return end;
};

eventSchema.methods.hasStarted = function () {
  return Date.now() >= this.getStartDateTime().getTime();
};

eventSchema.methods.hasEnded = function () {
  return Date.now() >= this.getEndDateTime().getTime();
};

eventSchema.methods.isFull = function () {
  return this.availableSeats <= 0;
};

module.exports = mongoose.model("Event", eventSchema);
module.exports.EVENT_STATUSES = EVENT_STATUSES;
module.exports.EVENT_MODES = EVENT_MODES;
