const cron = require("node-cron");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const { sendEventReminderEmail } = require("./emailService");

const REMINDER_WINDOWS = [
  { key: "24h", hoursBefore: 24, windowMinutes: 15 },
  { key: "1h", hoursBefore: 1, windowMinutes: 15 },
];

/**
 * Finds confirmed bookings for non-cancelled events whose start time falls
 * inside one of the reminder windows, and sends a reminder email once per
 * booking per window (tracked via booking.remindersSent).
 */
async function runReminderSweep() {
  const now = Date.now();

  for (const window of REMINDER_WINDOWS) {
    const targetTime = now + window.hoursBefore * 60 * 60 * 1000;
    const windowMs = window.windowMinutes * 60 * 1000;

    const events = await Event.find({
      status: { $in: ["upcoming", "ongoing"] },
    });

    for (const event of events) {
      const startMs = event.getStartDateTime().getTime();
      if (Math.abs(startMs - targetTime) > windowMs) continue;

      const bookings = await Booking.find({
        eventId: event._id,
        status: "confirmed",
        remindersSent: { $ne: window.key },
      });

      for (const booking of bookings) {
        await sendEventReminderEmail(event, booking, window.hoursBefore);
        booking.remindersSent.push(window.key);
        await booking.save();
      }
    }
  }
}

/**
 * Starts a cron job that sweeps for due reminders every 10 minutes.
 * Call once at server startup.
 */
function startReminderScheduler() {
  cron.schedule("*/10 * * * *", () => {
    runReminderSweep().catch((err) =>
      console.error("Reminder sweep failed:", err.message)
    );
  });
  console.log("Reminder scheduler started (runs every 10 minutes).");
}

module.exports = { startReminderScheduler, runReminderSweep };
